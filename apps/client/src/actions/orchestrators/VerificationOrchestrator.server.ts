import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const verifyPhoneWithTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ smsId: z.string().trim().min(3).max(80) }))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if the transaction ID matches a successful transaction
    // It can match `provider_ref` or `tx_id`
    const { data: txList, error } = await supabaseAdmin
      .from("transactions")
      .select("id, user_id, status")
      .or(`provider_ref.eq.${data.smsId},tx_id.eq.${data.smsId}`)
      .eq("status", "validated") // Must be successful
      .limit(1);

    if (error) throw new Error(error.message);
    
    const tx = txList?.[0];
    if (!tx) {
      throw new Error("Identifiant de transaction introuvable ou transaction non validée.");
    }

    if (tx.user_id !== context.userId) {
      throw new Error("Cette transaction appartient à un autre utilisateur.");
    }

    // Verify the profile
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ is_verified: true })
      .eq("id", context.userId);

    if (updateError) throw new Error(updateError.message);

    return { success: true };
  });
