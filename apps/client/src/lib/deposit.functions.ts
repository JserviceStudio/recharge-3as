import { createServerFn } from "@tanstack/react-start";
import { DepositOrchestrator } from "../actions/orchestrators/DepositOrchestrator.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Définition de l'action serveur pour initier le dépôt
// Le compte vient du jeton (middleware), jamais du corps : sinon n'importe qui crée des
// demandes au nom d'un autre client.
export const initiateDepositFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    userId?: string;
    id1xbet: string;
    amount: number;
    paymentMethodId: string;
    paymentMethodLabel: string;
    userPhone: string;
    network: string;
  }) => data)
  .handler(async (ctx: any) => {
    try {
      const data = { ...ctx.data, userId: ctx.context.userId };
      const { tx, checkoutUrl } = await DepositOrchestrator.initiateDeposit(data);
      return { success: true, transactionId: tx.id, checkoutUrl };
    } catch (error: any) {
      console.error("[initiateDepositFn error]", error);
      throw new Error(error.message || "Erreur lors de l'initiation du dépôt");
    }
  });
