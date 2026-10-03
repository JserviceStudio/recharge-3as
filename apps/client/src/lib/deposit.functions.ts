import { createServerFn } from "@tanstack/react-start";
import { DepositOrchestrator } from "../actions/orchestrators/DepositOrchestrator.server";

// Définition de l'action serveur pour initier le dépôt
export const initiateDepositFn = createServerFn({ method: "POST" })
  .inputValidator((data: {
    userId: string;
    id1xbet: string;
    amount: number;
    paymentMethodId: string;
    paymentMethodLabel: string;
    userPhone: string;
  }) => data)
  .handler(async (ctx: any) => {
    try {
      const data = ctx.data;
      const { tx, checkoutUrl } = await DepositOrchestrator.initiateDeposit(data);
      return { success: true, transactionId: tx.id, checkoutUrl };
    } catch (error: any) {
      console.error("[initiateDepositFn error]", error);
      throw new Error(error.message || "Erreur lors de l'initiation du dépôt");
    }
  });
