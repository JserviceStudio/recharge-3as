import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

export const validateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx, error: e1 } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", data.id)
      .eq("status", "pending")
      .single();
    if (e1 || !tx) throw new Error(e1?.message || "Transaction introuvable");

    let newStatus: import("@/integrations/supabase/types").Database["public"]["Enums"]["tx_status"] = "validated";
    let providerRef = tx.provider_ref;

    // Si c'est un RETRAIT, on déclenche le transfert FedaPay (Payout)
    if (tx.type === "withdrawal") {
      const { FedaPayAdapter } = await import("@/server/adapters/FedaPayAdapter");
      // Déduction du mode (MTN ou Moov) selon le label, par défaut mtn
      const mode = tx.payment_method_label?.toLowerCase().includes("moov") ? "moov" : "mtn";
      const phone = tx.recipient_number || "00000000";

      const payout = await FedaPayAdapter.createPayout(tx.amount, phone, tx.id, mode);
      
      if (!payout.isSuccess) {
        throw new Error("L'envoi des fonds via FedaPay a échoué. Vérifiez le solde du compte marchand.");
      }
      
      // On passe en crediting, car FedaPay traite le transfert
      newStatus = "crediting";
      providerRef = payout.providerRef;
    }

    const { error: eUpdate } = await supabaseAdmin
      .from("transactions")
      .update({ 
        status: newStatus, 
        validated_at: new Date().toISOString(), 
        validated_by: context.userId,
        provider_ref: providerRef
      })
      .eq("id", data.id);
      
    if (eUpdate) throw new Error(eUpdate.message);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "validate_transaction",
      target_id: data.id,
      details: { amount: tx?.amount, type: tx?.type },
    });
    return { ok: true };
  });

export const rejectTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; reason: string }) => {
    if (!d.reason || d.reason.trim().length < 3 || d.reason.length > 500) {
      throw new Error("Motif invalide");
    }
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("transactions")
      .update({ status: "rejected", rejection_reason: data.reason.trim(), validated_by: context.userId })
      .eq("id", data.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "reject_transaction",
      target_id: data.id,
      details: { reason: data.reason.trim() },
    });
    return { ok: true };
  });

export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("bootstrap_first_admin", { _user_id: context.userId });
    if (error) throw new Error(error.message);
    return { promoted: data === true };
  });

export const retryCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tx, error: e1 } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("id", data.id)
      .eq("status", "failed_credit")
      .single();
    if (e1 || !tx) throw new Error(e1?.message || "Transaction introuvable ou statut incorrect");

    // Lancer la relance en background
    const { XbetAdapter } = await import("@/server/adapters/XbetAdapter");
    await XbetAdapter.creditAccountWithRetry(
      tx.id, tx.amount, tx.id_1xbet, tx.provider_ref || "RETRY").catch(console.error);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "retry_credit",
      target_id: data.id,
      details: { amount: tx.amount },
    });
    return { ok: true };
  });

export const forceManualCredit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; comment: string }) => {
    if (!d.comment || d.comment.trim().length < 3) throw new Error("Commentaire requis");
    return d;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "validated",
        validated_at: new Date().toISOString(),
        validated_by: context.userId,
        failure_reason: `[Forcé manuellement] ${data.comment.trim()}`
      })
      .eq("id", data.id)
      .eq("status", "failed_credit");
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "force_manual_credit",
      target_id: data.id,
      details: { comment: data.comment.trim() },
    });
    return { ok: true };
  });
