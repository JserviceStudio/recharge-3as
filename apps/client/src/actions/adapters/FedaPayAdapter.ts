import * as crypto from "node:crypto";
import { FedaPay, Transaction } from "fedapay";
import { DepositRequestPayload } from "@/types/backend";

export class FedaPayAdapter {
  private static configure() {
    const key = process.env.FEDAPAY_SECRET_KEY;
    if (!key) throw new Error("FEDAPAY_SECRET_KEY is missing");
    FedaPay.setApiKey(key);
    FedaPay.setEnvironment(key.startsWith("sk_live") ? "live" : "sandbox");
  }

  /**
   * Crée une transaction Hosted Checkout FedaPay.
   * Retourne l'URL de redirection et la référence fournisseur.
   */
  static async createPaymentRequest(
    payload: DepositRequestPayload,
    internalTxId: string,
    returnUrl: string
  ): Promise<{ isSuccess: boolean; providerRef: string | null; checkoutUrl?: string }> {
    this.configure();
    console.log(`[FedaPayAdapter] Initialisation du paiement pour TX ${internalTxId} - Montant: ${payload.amount}`);

    try {
      const transaction = await Transaction.create({
        amount: Math.round(payload.amount),
        currency: { iso: "XOF" },
        description: `Recharge 3AS - Compte 1XBET ${payload.id1xbet}`,
        callback_url: returnUrl,
        customer: {
          firstname: "Client",
          lastname: "3AS",
          email: "guest@jmoai.net", // Placeholder selon docs
          phone_number: {
            number: payload.userPhone,
            country: "BJ",
          },
        },
        custom_metadata: {
          client_id: payload.userId,
          internal_tx_id: internalTxId,
          type: "RECHARGE_1XBET",
          id1xbet: payload.id1xbet,
        },
      });

      const tokenResponse = await transaction.generateToken();

      return {
        isSuccess: true,
        providerRef: String(transaction.id), // FedaPay internal ID
        checkoutUrl: tokenResponse.url,
      };
    } catch (error: any) {
      console.error("[FedaPayAdapter] Erreur création transaction:", error?.message || error);
      return { isSuccess: false, providerRef: null };
    }
  }

  /**
   * Signature HMAC (Security First)
   * Valide que le Webhook provient bien de FedaPay (reprise stricte de jservices-api)
   */
  static verifyWebhookSignature(payload: any, signatureHeader: string): boolean {
    const secret = process.env.FEDAPAY_WEBHOOK_SECRET;
    if (!secret || !signatureHeader) return false;

    // 1. Extraction propre (t=timestamp, s=signature)
    const parts = signatureHeader.split(",");
    const t = parts.find((p) => p.startsWith("t="))?.split("=")[1];
    const s =
      parts.find((p) => p.startsWith("s="))?.split("=")[1] ||
      parts.find((p) => p.startsWith("v1="))?.split("=")[1];

    const signature = (s || signatureHeader).trim();
    if (signature.length !== 64) return false;

    const payloadString = typeof payload === "string" ? payload : JSON.stringify(payload);

    // 2. Tests des combinaisons standards
    const hashRaw = crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
    const hashWithT = t
      ? crypto.createHmac("sha256", secret).update(t + payloadString).digest("hex")
      : null;
    const hashWithDot = t
      ? crypto.createHmac("sha256", secret).update(t + "." + payloadString).digest("hex")
      : null;

    const candidates = [hashRaw, hashWithT, hashWithDot].filter(Boolean) as string[];
    return candidates.some((cand) => {
      try {
        return crypto.timingSafeEqual(Buffer.from(cand), Buffer.from(signature));
      } catch (e) {
        return false;
      }
    });
  }
}
