import { createClient } from "@supabase/supabase-js";
import { supabase as defaultClient } from "@/integrations/supabase/client";
import { TransactionStatus, TransactionType } from "@/types/backend";

import fs from "node:fs";
import path from "node:path";

function getAdminClient() {
  const url = process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
  let key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Si Vite a masqué la variable car elle n'a pas le préfixe VITE_, on va la lire directement dans le fichier .env
  if (!key) {
    try {
      const possiblePaths = [
        path.resolve(process.cwd(), ".env"),
        path.resolve(process.cwd(), "../../.env") // Si process.cwd() est dans apps/client
      ];

      for (const envPath of possiblePaths) {
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, "utf-8");
          const match = content.match(/^SUPABASE_SERVICE_ROLE_KEY=(.*)$/m);
          if (match) {
            key = match[1].trim();
            break;
          }
        }
      }
    } catch (e) {
      console.warn("[TransactionRepository] Impossible de lire le fichier .env manuellement.");
    }
  }

  if (!key) {
    throw new Error("⚠️ SUPABASE_SERVICE_ROLE_KEY est introuvable. Veuillez vérifier votre fichier .env.");
  }
  
  return createClient(url, key);
}

export class TransactionRepository {
  /**
   * Crée une transaction initiale dans la BDD.
   */
  static async createTransaction(data: {
    userId: string;
    type: TransactionType;
    id1xbet: string;
    amount: number;
    paymentMethodId: string;
    paymentMethodLabel: string;
    status: TransactionStatus;
  }) {
    let pMethodId = data.paymentMethodId;
    // Vérification basique d'un format UUID. FedaPay gérant le réseau, on peut omettre cet ID.
    if (!pMethodId || pMethodId.length !== 36) {
      pMethodId = null as any; // On passe null car la sélection du réseau se fait chez FedaPay
    }

    const adminClient = getAdminClient();
    const { data: tx, error } = await adminClient.from("transactions").insert({
      user_id: data.userId,
      type: data.type,
      id_1xbet: data.id1xbet,
      amount: data.amount,
      payment_method_id: pMethodId,
      payment_method_label: data.paymentMethodLabel,
      status: data.status,
    }).select().single();

    if (error || !tx) {
      throw new Error(`Erreur DB (createTransaction): ${error?.message}`);
    }
    return tx;
  }

  /**
   * Met à jour le statut d'une transaction via son ID
   */
  static async updateStatus(id: string, status: TransactionStatus, additionalData: any = {}) {
    const adminClient = getAdminClient();
    const { error } = await adminClient.from("transactions").update({
      status,
      ...additionalData
    }).eq("id", id);
    if (error) throw new Error(`Erreur DB (updateStatus): ${error.message}`);
  }

  /**
   * Récupère une transaction via la référence du fournisseur (Agrégateur)
   */
  static async getByProviderRef(providerRef: string) {
    const adminClient = getAdminClient();
    const { data: tx, error } = await adminClient.from("transactions").select("*").eq("provider_ref", providerRef).single();
    if (error || !tx) {
      return null;
    }
    return tx;
  }

  /**
   * Loggue un appel API dans api_logs
   */
  static async logApiCall(data: {
    transactionId: string;
    provider: "aggregator" | "xbet" | "fedapay";
    endpoint: string;
    httpStatus: number;
    requestPayload?: any;
    responsePayload?: any;
  }) {
    const adminClient = getAdminClient();
    await adminClient.from("api_logs").insert({
      transaction_id: data.transactionId,
      provider: data.provider as any,
      endpoint: data.endpoint,
      http_status: data.httpStatus,
      request_payload: data.requestPayload,
      response_payload: data.responsePayload
    });
  }
}
