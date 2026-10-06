import * as crypto from "node:crypto";
import { FedaPay, Transaction } from "fedapay";
import { DepositRequestPayload } from "@/types/backend";
import { loadServerEnv } from "../../server-env";

export class FedaPayAdapter {
  private static configure() {
    loadServerEnv();
    const key = process.env.FEDAPAY_SECRET_KEY;
    if (!key) throw new Error("FEDAPAY_SECRET_KEY is missing");
    FedaPay.setApiKey(key);
    FedaPay.setEnvironment(key.startsWith("sk_live") ? "live" : "sandbox");
  }

  static async createPaymentRequest(
    payload: DepositRequestPayload,
    internalTxId: string
  ): Promise<{ isSuccess: boolean; providerRef: string | null }> {
    this.configure();
    console.log(`[FedaPayAdapter] Initialisation du paiement DIRECT pour TX ${internalTxId}`);
    
    let countryCode = "BJ";
    let phoneNumber = payload.userPhone.replace("+", "");
    
    // Déduction du pays (peut être ajusté selon vos besoins)
    if (phoneNumber.startsWith("229")) {
      countryCode = "BJ";
      phoneNumber = phoneNumber.substring(3);
    } else if (phoneNumber.startsWith("228")) {
      countryCode = "TG";
      phoneNumber = phoneNumber.substring(3);
    } else if (phoneNumber.startsWith("225")) {
      countryCode = "CI";
      phoneNumber = phoneNumber.substring(3);
    }

    try {
      const transaction = await Transaction.create({
        amount: Math.round(payload.amount),
        currency: { iso: "XOF" },
        description: `Recharge 3AS - Compte 1XBET ${payload.id1xbet}`,
        customer: {
          firstname: "Client",
          lastname: "3AS",
          email: "support@3asrecharge.com", 
          phone_number: {
            number: phoneNumber,
            country: countryCode,
          },
        },
        custom_metadata: {
          client_id: payload.userId,
          internal_tx_id: internalTxId,
          type: "RECHARGE_1XBET",
          id1xbet: payload.id1xbet,
        },
      });

      // LE CHANGEMENT MAGIQUE EST ICI : On envoie la requête push USSD directement au réseau
      // payload.network doit correspondre aux codes FedaPay (ex: "mtn", "moov", "mtn_ci")
      await transaction.sendNow(payload.network);

      return {
        isSuccess: true,
        providerRef: String(transaction.id), // ID FedaPay
      };
    } catch (error: any) {
      console.error("[FedaPayAdapter] Erreur création transaction FedaDirect:", error?.message || error);
      return { isSuccess: false, providerRef: null };
    }
  }

  /**
   * Signature HMAC (Security First)
   * Valide que le Webhook provient bien de FedaPay (reprise stricte de jservices-api)
   */
  static verifyWebhookSignature(payload: any, signatureHeader: string): boolean {
    loadServerEnv();
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
