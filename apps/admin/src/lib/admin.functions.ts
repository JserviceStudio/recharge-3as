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

    // Étape 1 : Réservation atomique (update status='paid' where id=... and status='pending' returning *)
    // Évite tout double-clic ou double-traitement concurrent. Si 0 ligne, la demande a déjà été prise en charge.
    const { data: updatedRows, error: eReserve } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "paid",
        validated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "pending")
      .select();

    if (eReserve) throw new Error(eReserve.message);
    if (!updatedRows || updatedRows.length === 0) {
      throw new Error("Transaction déjà traitée ou introuvable.");
    }
    const tx = updatedRows[0];

    // Traitement pour une RECHARGE manuelle
    if (tx.type === "recharge") {
      const { error: eValidate } = await supabaseAdmin
        .from("transactions")
        .update({
          status: "validated",
          validated_at: new Date().toISOString(),
          validated_by: context.userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tx.id);
      if (eValidate) throw new Error(eValidate.message);

      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "validate_transaction",
        target_id: tx.id,
        details: { amount: tx.amount, type: tx.type },
      });
      return { ok: true };
    }

    // Traitement pour un RETRAIT (withdrawal)
    // Contrôles stricts AVANT encaissement 1XBET : moyen de paiement valide et numéro normalisable.
    // En cas d'échec : remise immédiate en pending, journalisation admin_logs, erreur levée (aucun appel 1XBET).
    const rollbackToPending = async (reason: string) => {
      await supabaseAdmin
        .from("transactions")
        .update({
          status: "pending",
          validated_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tx.id)
        .eq("status", "paid");

      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "abort_withdrawal_validation",
        target_id: tx.id,
        details: { reason },
      });

      throw new Error(reason);
    };

    if (!tx.payment_method_id) {
      await rollbackToPending("Moyen de paiement non spécifié pour ce retrait.");
    }

    const { data: method, error: methodErr } = await supabaseAdmin
      .from("payment_methods")
      .select("payout_mode, country")
      .eq("id", tx.payment_method_id)
      .maybeSingle();

    if (methodErr || !method || !method.payout_mode || !method.country) {
      await rollbackToPending("Moyen de paiement introuvable ou configuration de virement incomplète (payout_mode ou country manquant).");
    }

    const payoutMode = (method.payout_mode || "").trim();
    const country = (method.country || "").trim() as import("./mobile-money").CodePays;

    if (!payoutMode || !country) {
      await rollbackToPending("Configuration de virement incomplète pour ce moyen de paiement.");
    }

    // Normalisation stricte du numéro pour FedaPay (aucun repli sur les chiffres bruts)
    const { normaliserNumero } = await import("./mobile-money");
    const norm = normaliserNumero(country, tx.recipient_number || "");
    if (!norm || !norm.national) {
      await rollbackToPending(`Numéro de bénéficiaire invalide (${tx.recipient_number}) pour le pays ${country}.`);
    }
    const nationalPhone = norm.national;

    // Étape 2 : Encaissement du code chez 1XBET (une seule tentative, timeout 30 s)
    const { XbetAdapter } = await import("@/server/adapters/XbetAdapter");
    const xbetRes = await XbetAdapter.payout(tx.id_1xbet, tx.tx_id || "", { transactionId: tx.id });

    if (!xbetRes.success) {
      if (xbetRes.explicitRejection) {
        // Refus explicite 1XBET -> rejected + motif, AUCUN virement
        await supabaseAdmin.from("transactions").update({
          status: "rejected",
          rejection_reason: xbetRes.message,
          validated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", tx.id);

        await supabaseAdmin.from("admin_logs").insert({
          admin_id: context.userId,
          action: "reject_transaction_1xbet",
          target_id: tx.id,
          details: { reason: xbetRes.message },
        });

        throw new Error(`Encaissement 1XBET refusé : ${xbetRes.message}`);
      } else {
        // Délai ou erreur réseau -> failed_credit « RÉSULTAT INCERTAIN : vérifier la caisse 1XBET avant tout virement », AUCUN virement
        const raison = xbetRes.message;
        await supabaseAdmin.from("transactions").update({
          status: "failed_credit",
          failure_reason: raison,
          updated_at: new Date().toISOString(),
        }).eq("id", tx.id);

        await supabaseAdmin.from("admin_logs").insert({
          admin_id: context.userId,
          action: "uncertain_1xbet_payout",
          target_id: tx.id,
          details: { reason: raison },
        });

        throw new Error(raison);
      }
    }

    // Étape 3 : Montant à virer = Math.abs(Summa) (ce que la caisse a réellement reçu)
    const xbetPayoutRef = xbetRes.messageId ? String(xbetRes.messageId) : `XBET-PAYOUT-${Date.now()}`;
    const montantReel = Math.abs(xbetRes.summa);

    if (!Number.isFinite(montantReel) || !Number.isInteger(montantReel) || montantReel <= 0) {
      const raisonIncertaine = "RÉSULTAT INCERTAIN : 1XBET a confirmé sans montant exploitable, vérifier la caisse";
      await supabaseAdmin.from("transactions").update({
        status: "failed_credit",
        failure_reason: raisonIncertaine,
        xbet_payout_ref: xbetPayoutRef,
        updated_at: new Date().toISOString(),
      }).eq("id", tx.id);

      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "uncertain_1xbet_payout_invalid_summa",
        target_id: tx.id,
        details: { reason: raisonIncertaine, summa: xbetRes.summa, xbet_payout_ref: xbetPayoutRef },
      });

      throw new Error(raisonIncertaine);
    }

    let discrepancyNote: string | null = null;
    if (montantReel !== Number(tx.amount)) {
      discrepancyNote = `Écart montant : déclaré ${tx.amount} FCFA, réel reçu 1XBET ${montantReel} FCFA. Virement du montant réel.`;
    }

    // Étape 4 : Virement FedaPay : FedaPayAdapter.createPayout(montant, numéroNational, txId, payout_mode, pays)
    const { FedaPayAdapter } = await import("@/server/adapters/FedaPayAdapter");
    const payout = await FedaPayAdapter.createPayout(
      montantReel,
      nationalPhone,
      tx.id,
      payoutMode,
      country,
    );

    if (!payout.isSuccess) {
      // Échec virement -> failed_credit « code 1XBET encaissé, virement non parti » (l'argent est dans la caisse)
      const raisonEchec = `code 1XBET encaissé, virement non parti${discrepancyNote ? ` (${discrepancyNote})` : ""}`;
      await supabaseAdmin.from("transactions").update({
        status: "failed_credit",
        amount: montantReel,
        xbet_payout_ref: xbetPayoutRef,
        failure_reason: raisonEchec,
        validated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", tx.id);

      await supabaseAdmin.from("admin_logs").insert({
        admin_id: context.userId,
        action: "failed_payout_fedapay",
        target_id: tx.id,
        details: { error: payout.error, montant: montantReel, xbet_payout_ref: xbetPayoutRef },
      });

      throw new Error("Code 1XBET encaissé, mais le virement FedaPay a échoué. L'argent est dans la caisse.");
    }

    // Succès du déclenchement du virement -> crediting + provider_ref
    await supabaseAdmin.from("transactions").update({
      status: "crediting",
      amount: montantReel,
      xbet_payout_ref: xbetPayoutRef,
      provider_ref: payout.providerRef,
      failure_reason: discrepancyNote,
      validated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", tx.id);

    await supabaseAdmin.from("admin_logs").insert({
      admin_id: context.userId,
      action: "validate_transaction",
      target_id: tx.id,
      details: {
        amount: montantReel,
        type: tx.type,
        xbet_payout_ref: xbetPayoutRef,
        provider_ref: payout.providerRef,
        discrepancy: discrepancyNote,
      },
    });

    return { ok: true, amount: montantReel };
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
