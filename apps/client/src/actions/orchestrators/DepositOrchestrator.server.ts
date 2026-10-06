import { TransactionRepository } from "../repositories/TransactionRepository";
import { XbetAdapter } from "../adapters/XbetAdapter";
import { FedaPayAdapter } from "../adapters/FedaPayAdapter";
import { DepositRequestPayload, AggregatorWebhookPayload } from "@/types/backend";
import { loadServerEnv } from "../../server-env";

/**
 * Orchestrateur principal gérant le cycle de vie du dépôt.
 * Il délègue les tâches aux Adapters et au Repository.
 */
export class DepositOrchestrator {
  /**
   * Étape 1 : Le client initie la demande
   */
  static async initiateDeposit(payload: DepositRequestPayload) {
    loadServerEnv(); // Sécurité pour s'assurer que les env sont là
    
    // 1. Vérification préalable 1XBET
    const isValid = await XbetAdapter.verifyAccount(payload.id1xbet);
    if (!isValid) {
      throw new Error("L'ID 1XBET fourni est invalide ou introuvable.");
    }

    // 2. Création de la transaction en base
    const tx = await TransactionRepository.createTransaction({
      userId: payload.userId,
      type: "recharge",
      id1xbet: payload.id1xbet,
      amount: payload.amount,
      paymentMethodId: payload.paymentMethodId,
      paymentMethodLabel: payload.paymentMethodLabel,
      status: "awaiting_payment",
    });

    // 3. Appel de l'API Agrégateur (FedaPay)
    console.log(`[DepositOrchestrator] Initiation FedaPay pour TX ${tx.id}...`);
    // Définition de l'URL de retour (où le client sera redirigé après paiement)
    const returnUrl = `${process.env.PUBLIC_URL || "http://localhost:5173"}/historique?tx=${tx.id}`;
    
    const { isSuccess, providerRef, checkoutUrl } = await FedaPayAdapter.createPaymentRequest(
      payload, 
      tx.id,
      returnUrl
    );

    if (!isSuccess || !providerRef || !checkoutUrl) {
      await TransactionRepository.updateStatus(tx.id, "rejected", { failure_reason: "Échec initiation agrégateur" });
      throw new Error("Impossible d'initier le paiement avec l'opérateur.");
    }

    // Mise à jour de la réf fournisseur
    await TransactionRepository.updateStatus(tx.id, "awaiting_payment", { provider_ref: providerRef });

    // Log API
    await TransactionRepository.logApiCall({
      transactionId: tx.id,
      provider: "fedapay",
      endpoint: "/v1/transactions",
      httpStatus: 200,
      requestPayload: { amount: payload.amount, phone: payload.userPhone },
      responsePayload: { ref: providerRef, checkoutUrl }
    });

    return { tx, checkoutUrl };
  }

  /**
   * Étape 2 : L'agrégateur (FedaPay) notifie l'app via Webhook
   */
  static async handleAggregatorWebhook(payload: AggregatorWebhookPayload, signature: string) {
    loadServerEnv(); // Important pour le webhook FedaPay et Supabase

    // 1. Valider la signature
    const isValidSig = FedaPayAdapter.verifyWebhookSignature(payload.rawPayload || payload, signature);
    if (!isValidSig) {
      throw new Error("Signature Webhook Invalide");
    }

    // Extraction de la référence et du statut (selon la structure de FedaPay)
    const entity = (payload.rawPayload as any)?.entity || payload.rawPayload;
    // FedaPay envoie le statut sous `status` (ex: "approved", "canceled") et l'ID sous `id`
    const status = entity?.status === "approved" ? "successful" : (entity?.status === "canceled" ? "failed" : "pending");
    const amountPaid = entity?.amount;
    const providerRef = String(entity?.id || payload.reference);

    console.log(`[DepositOrchestrator] Webhook reçu pour réf ${providerRef} avec statut brut ${entity?.status} (évalué: ${status})`);

    // 2. Récupérer la transaction correspondante via le Repository
    const tx = await TransactionRepository.getByProviderRef(providerRef);
    if (!tx) {
      console.error(`Transaction non trouvée pour la réf ${providerRef}`);
      return;
    }

    // 3. Idempotence
    if (["paid", "crediting", "validated", "failed_credit"].includes(tx.status)) {
      console.log(`[DepositOrchestrator] TX ${tx.id} déjà traitée (statut ${tx.status}). Webhook ignoré.`);
      return;
    }

    // 4. Gestion de l'échec client
    if (status !== 'successful') {
      await TransactionRepository.updateStatus(tx.id, "rejected", { provider_status: status });
      return;
    }

    // 5. Sécurité: Montant
    if (amountPaid !== tx.amount) {
      console.error(`[DepositOrchestrator] Montant incorrect ! Attendu: ${tx.amount}, Reçu: ${amountPaid}`);
      await TransactionRepository.updateStatus(tx.id, "failed_credit", { 
        failure_reason: `Alerte sécurité: Montant encaissé (${amountPaid}) différent du montant attendu (${tx.amount})`
      });
      return;
    }

    // 6. Paiement validé
    await TransactionRepository.updateStatus(tx.id, "paid", { provider_status: status });

    // 6.bis Mettre à jour le profil utilisateur (is_verified = true)
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const adminSupabase = createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
        (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY) as string
      );
      await adminSupabase.from("profiles").update({ 
        is_verified: true,
        verified_by_tx_id: tx.id 
      }).eq("id", tx.user_id);
      console.log(`[DepositOrchestrator] Profil utilisateur ${tx.user_id} vérifié avec succès via le paiement (TX: ${tx.id}).`);
    } catch (err) {
      console.error("[DepositOrchestrator] Échec de la vérification du profil:", err);
    }

    // 7. Lancement asynchrone du crédit 1XBET
    XbetAdapter.creditAccountWithRetry(tx.id, tx.amount, tx.id_1xbet, providerRef).catch(console.error);
  }
}
