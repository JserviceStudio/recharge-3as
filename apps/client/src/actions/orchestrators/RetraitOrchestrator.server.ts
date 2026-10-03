import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const submitWithdrawalSchema = z.object({
  id_1xbet: z.string().trim().min(3).max(30),
  amount: z.coerce.number().min(500).max(10_000_000),
  payment_method_id: z.string().uuid(),
  payment_method_label: z.string(),
  recipient_number: z.string().trim().min(8).max(20),
  tx_id: z.string().trim().min(3).max(80),
});

export const submitWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof submitWithdrawalSchema>) => data)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // AML Rule 1: No concurrent pending withdrawals
    const { count: pendingCount, error: countError } = await supabaseAdmin
      .from("transactions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("type", "withdrawal")
      .eq("status", "pending");

    if (countError) throw new Error(countError.message);
    if (pendingCount && pendingCount > 0) {
      throw new Error("Vous avez déjà une demande de retrait en attente. Veuillez patienter.");
    }

    // AML Rule 2: Daily limit of 2,000,000 FCFA
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { data: todayTx, error: todayError } = await supabaseAdmin
      .from("transactions")
      .select("amount")
      .eq("user_id", context.userId)
      .eq("type", "withdrawal")
      .gte("created_at", today.toISOString());

    if (todayError) throw new Error(todayError.message);
    
    const totalToday = todayTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
    if (totalToday + data.amount > 2_000_000) {
      throw new Error(`Limite journalière atteinte. Vous pouvez encore retirer ${Math.max(0, 2_000_000 - totalToday)} FCFA aujourd'hui.`);
    }

    // Insert the transaction safely on the server
    const { data: newTx, error: insertError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: context.userId,
        type: "withdrawal",
        id_1xbet: data.id_1xbet,
        amount: data.amount,
        payment_method_id: data.payment_method_id,
        payment_method_label: data.payment_method_label,
        tx_id: data.tx_id,
        recipient_number: data.recipient_number,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) throw new Error(insertError.message);

    return { success: true, transaction: newTx };
  });
