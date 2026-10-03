import { supabase } from "@/integrations/supabase/client";
import { TransactionStatus, TransactionType } from "@/types/backend";

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
    const { data: tx, error } = await supabase.from("transactions").insert({
      user_id: data.userId,
      type: data.type,
      id_1xbet: data.id1xbet,
      amount: data.amount,
      payment_method_id: data.paymentMethodId,
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
    const { error } = await supabase.from("transactions").update({
      status,
      ...additionalData
    }).eq("id", id);
    if (error) throw new Error(`Erreur DB (updateStatus): ${error.message}`);
  }

  /**
   * Récupère une transaction via la référence du fournisseur (Agrégateur)
   */
  static async getByProviderRef(providerRef: string) {
    const { data: tx, error } = await supabase.from("transactions").select("*").eq("provider_ref", providerRef).single();
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
    await supabase.from("api_logs").insert({
      transaction_id: data.transactionId,
      provider: data.provider as any,
      endpoint: data.endpoint,
      http_status: data.httpStatus,
      request_payload: data.requestPayload,
      response_payload: data.responsePayload
    });
  }
}
