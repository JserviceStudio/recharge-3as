import { TransactionRepository } from "../repositories/TransactionRepository";
import { XbetAdapter } from "../adapters/XbetAdapter";
import { FedaPayAdapter } from "../adapters/FedaPayAdapter";
import { DepositRequestPayload, AggregatorWebhookPayload } from "@/types/backend";
import { loadServerEnv } from "../../server-env";
import { PAYS, normaliserNumero, reseauRecharge } from "@/lib/mobile-money";

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

    // 0. Réseau et numéro contrôlés AVANT toute écriture : sinon une demande orpheline reste
    // « Paiement attendu » sans qu'aucun paiement n'ait été demandé.
    const reseau = reseauRecharge(payload.network);
    if (!reseau) throw new Error("Choisissez un réseau Mobile Money pris en charge.");
    if (!normaliserNumero(reseau.pays, payload.userPhone)) {
      throw new Error(`Numéro ${PAYS[reseau.pays].nom} invalide (ex : +${PAYS[reseau.pays].indicatif} ${PAYS[reseau.pays].exemple}).`);
    }
    const montant = Number(payload.amount);
    if (!Number.isInteger(montant) || montant < 100 || montant > 10_000_000) {
      throw new Error("Montant invalide : minimum 100 FCFA, nombre entier.");
    }

    // 1. Vérification préalable 1XBET
    const isValid = await XbetAdapter.verifyAccount(payload.id1xbet);
    if (!isValid) {
      if (XbetAdapter.derniereRaison === "CURRENCY_MISMATCH") {
        throw new Error(
          "Ce compte 1XBET n'est pas en francs CFA : la recharge est impossible sur ce compte. Aucun paiement n'a été demandé.",
        );
      }
      throw new Error("L'ID 1XBET fourni est invalide ou introuvable.");
    }

    // 2. Création de la transaction en base
    const tx = await TransactionRepository.createTransaction({
      userId: payload.userId,
      type: "recharge",
      id1xbet: payload.id1xbet,
      amount: payload.amount,
      paymentMethodId: payload.paymentMethodId,
      paymentMethodLabel: `FedaPay ${reseau.nom} ${PAYS[reseau.pays].nom}`,
      status: "awaiting_payment",
    });

    // 3. Appel de l'API Agrégateur (FedaPay Direct)
    console.log(`[DepositOrchestrator] Initiation FedaPay Direct pour TX ${tx.id}...`);
    
    const { isSuccess, providerRef } = await FedaPayAdapter.createPaymentRequest(
      payload, 
      tx.id
    );

    if (!isSuccess || !providerRef) {
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
      requestPayload: { amount: payload.amount, phone: payload.userPhone, network: payload.network },
      responsePayload: { ref: providerRef }
    });

    return { tx };
  }

  /**
   * Étape 2 : L'agrégateur (FedaPay) notifie l'app via Webhook
   */
  /**
   * `options.rawBody` : le corps EXACT reçu (la signature FedaPay se calcule dessus, pas sur un
   * JSON reformaté). `options.verifiedByProviderApi` : réservé à la synchronisation, qui vient de
   * relire la transaction CHEZ FedaPay par l'API — la source fait foi, aucune signature à vérifier.
   * Jamais exposé par une route publique.
   */
  static async handleAggregatorWebhook(
    payload: AggregatorWebhookPayload,
    signature: string,
    options: { rawBody?: string; verifiedByProviderApi?: boolean } = {},
  ) {
    loadServerEnv(); // Important pour le webhook FedaPay et Supabase

    // 1. Valider la signature
    const isValidSig =
      options.verifiedByProviderApi === true ||
      FedaPayAdapter.verifyWebhookSignature(options.rawBody ?? (payload.rawPayload || payload), signature);
    if (!isValidSig) {
      throw new Error("Signature Webhook Invalide");
    }

    // Sécurité Webhook : Ne traiter que les événements transaction.* pour les recharges
    // (FedaPay sépare les IDs de transaction et payout dans deux espaces distincts)
    const eventName = (payload.rawPayload as any)?.name || (payload.rawPayload as any)?.event;
    if (eventName && !String(eventName).startsWith("transaction.")) {
      console.log(`[DepositOrchestrator] Événement ignoré car non-transaction (${eventName}).`);
      return;
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

    // Un webhook de recharge ne doit JAMAIS altérer un retrait (tx.type === 'recharge' strict)
    if (tx.type !== "recharge") {
      console.log(`[DepositOrchestrator] TX ${tx.id} ignorée car de type ${tx.type} (seules les recharges sont traitées).`);
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
