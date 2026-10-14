import { TransactionRepository } from "../repositories/TransactionRepository";
import * as crypto from "node:crypto";
import { loadServerEnv } from "../../server-env";

const BASE_URL = "https://partners.servcul.com/CashdeskBotAPI";

export class XbetAdapter {
  /** Raison du dernier refus de verifyAccount (ex. CURRENCY_MISMATCH), pour un message clair. */
  static derniereRaison: string | null = null;

  private static getConfig() {
    loadServerEnv();
    const hash = process.env.XBET_HASH;
    const cashierpass = process.env.XBET_CASHIERPASS;
    const cashdeskid = process.env.XBET_CASHDESKID;
    
    if (!hash || !cashierpass || !cashdeskid) {
      throw new Error("Configuration 1XBET manquante dans les variables d'environnement.");
    }

    return { hash, cashierpass, cashdeskid };
  }

  private static md5(str: string): string {
    return crypto.createHash("md5").update(str).digest("hex");
  }

  private static sha256(str: string): string {
    return crypto.createHash("sha256").update(str).digest("hex");
  }

  /**
   * Vérifie si un compte 1XBET existe.
   * Route: GET /Users/{userId}
   */
  static async verifyAccount(id1xbet: string): Promise<boolean> {
    try {
      const { hash, cashierpass, cashdeskid } = this.getConfig();

      const confirm = this.md5(`${id1xbet}:${hash}`);

      // Formation de la signature
      // 1. SHA256(hash={0}&userid={1}&cashdeskid={2}) — `userid` en MINUSCULES : avec `userId`, 1xBet répond 401 (testé le 2026-10-13).
      const part1 = this.sha256(`hash=${hash}&userid=${id1xbet}&cashdeskid=${cashdeskid}`);
      // 2. MD5(userid={0}&cashierpass={1}&hash={2})
      const part2 = this.md5(`userid=${id1xbet}&cashierpass=${cashierpass}&hash=${hash}`);
      // 3. SHA256(part1 + part2)
      const sign = this.sha256(`${part1}${part2}`);

      const url = `${BASE_URL}/Users/${id1xbet}?confirm=${confirm}&cashdeskid=${cashdeskid}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "sign": sign,
          "Content-Type": "application/json"
        }
      });

      if (res.status === 401 || res.status === 403) {
        console.error(`[XbetService] Erreur d'authentification ou signature invalide: HTTP ${res.status}`);
        return false; // Ou jeter une erreur selon le besoin
      }

      const data = await res.json();
      
      // 1xBet répond en PascalCase : {"UserId":…,"Name":…,"CurrencyId":…}.
      if (data && (data.UserId ?? data.userId)) {
        // La caisse ne crédite QUE les comptes de sa devise (27 = celle de notre caisse, prouvé
        // le 2026-10-13 ; 26 → « La devise du PDV ne correspond pas »). Le refuser ICI, avant
        // de demander le paiement : sinon le client paie et le crédit échoue.
        const attendue = String(process.env.XBET_CURRENCY_ID || "27");
        const devise = data.CurrencyId ?? data.currencyId;
        if (devise != null && String(devise) !== attendue) {
          this.derniereRaison = "CURRENCY_MISMATCH";
          console.warn(`[XbetService] Compte ${id1xbet} en devise ${devise}, caisse en ${attendue} : refusé avant paiement.`);
          return false;
        }
        this.derniereRaison = null;
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error(`[XbetService] Erreur lors de la vérification du compte:`, error.message);
      return false; // En cas de problème réseau, on rejette pour sécurité
    }
  }

  /**
   * Crédite le compte 1XBET avec retry automatique.
   * Route: POST Deposit/{userId}/Add
   */
  static async creditAccountWithRetry(transactionId: string, amount: number, id1xbet: string, providerRef: string) {
    // UN SEUL ESSAI. Rejouer un dépôt dont le résultat est incertain (délai dépassé, réponse
    // illisible, succès écrit `Success` au lieu de `success`) créditerait le joueur plusieurs
    // fois. Un échec passe en `failed_credit` avec sa raison : un humain vérifie sur 1xBet
    // avant tout nouveau crédit.
    const { hash, cashierpass, cashdeskid } = this.getConfig();
    const lng = "fr";
    const summa = Number(amount);
    const confirm = this.md5(`${id1xbet}:${hash}`);

    // Signature pour le dépôt ("Reception")
    // 1. SHA256(hash={0}&lng={1}&userid={2})
    const part1 = this.sha256(`hash=${hash}&lng=${lng}&userid=${id1xbet}`);
    // 2. MD5(summa={0}&cashierpass={1}&cashdeskid={2})
    const part2 = this.md5(`summa=${summa}&cashierpass=${cashierpass}&cashdeskid=${cashdeskid}`);
    // 3. SHA256(part1 + part2)
    const sign = this.sha256(`${part1}${part2}`);

    const url = `${BASE_URL}/Deposit/${id1xbet}/Add`;
    const body = { cashdeskid: parseInt(cashdeskid), lng, summa, confirm };
    const lire = (data: any, cle: string) =>
      data && typeof data === "object"
        ? data[cle] ?? data[cle.charAt(0).toUpperCase() + cle.slice(1)]
        : undefined;

    console.log(`[XbetAdapter] Crédit (essai unique) pour TX ${transactionId}...`);
    await TransactionRepository.updateStatus(transactionId, "crediting", { credit_attempts: 1 });

    let httpStatus = 0;
    let data: any = null;
    let erreurReseau: string | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { sign, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      httpStatus = res.status;
      data = await res.json().catch(() => null);
    } catch (error: any) {
      erreurReseau = error?.message || String(error);
    }

    await TransactionRepository.logApiCall({
      transactionId,
      provider: "xbet",
      endpoint: `/Deposit/${id1xbet}/Add`,
      httpStatus: httpStatus || 0,
      responsePayload: data ?? { error: erreurReseau },
    });

    if (httpStatus >= 200 && httpStatus < 300 && lire(data, "success") === true) {
      const messageId = lire(data, "messageId");
      await TransactionRepository.updateStatus(transactionId, "validated", {
        xbet_credit_ref: messageId ? String(messageId) : `XBET-OK-${Date.now()}`,
        credited_at: new Date().toISOString(),
      });
      console.log(`[XbetAdapter] Crédit réussi pour TX ${transactionId}`);
      return true;
    }

    // Refus explicite de 1xBet (Success=false + message) : rien n'a été crédité.
    // Tout le reste (réseau, délai, réponse illisible) est INCERTAIN : vérifier avant de rejouer.
    const refusExplicite = data && lire(data, "success") === false;
    const raison = refusExplicite
      ? `Refus 1XBET (HTTP ${httpStatus}): ${lire(data, "message") || "sans message"}`
      : `RÉSULTAT INCERTAIN — vérifier sur 1XBET avant tout nouveau crédit (HTTP ${httpStatus || "aucune réponse"}${erreurReseau ? `, ${erreurReseau}` : ""})`;
    await TransactionRepository.updateStatus(transactionId, "failed_credit", { failure_reason: raison });
    console.error(`[XbetAdapter] Crédit non confirmé pour TX ${transactionId} : ${raison}`);
    return false;
  }

  /**
   * Calcule la signature et le paramètre confirm pour le décaissement (Payout).
   * Utilisé pour l'appel API 1XBET et les tests de validation vectorielle.
   */
  static computePayoutSignature(
    hash: string,
    cashierpass: string,
    cashdeskid: string | number,
    userId: string,
    code: string,
  ): { sign: string; confirm: string } {
    // 1. SHA256(hash={0}&lng=fr&userid={1}) avec userid en minuscules
    const part1 = this.sha256(`hash=${hash}&lng=fr&userid=${userId}`);
    // 2. MD5(code={0}&cashierpass={1}&cashdeskid={2})
    const part2 = this.md5(`code=${code}&cashierpass=${cashierpass}&cashdeskid=${cashdeskid}`);
    // 3. SHA256(part1 + part2)
    const sign = this.sha256(`${part1}${part2}`);
    // confirm = MD5(userid:hash) avec userid en minuscules
    const confirm = this.md5(`${userId}:${hash}`);
    return { sign, confirm };
  }

  /**
   * Encaisse un code de retrait 1XBET (Payout caisse).
   * Route: POST {BASE_URL}/Deposit/{userId}/Payout
   * Une seule tentative, timeout 30 s. Le code n'est jamais journalisé en clair.
   */
  static async payout(
    userId: string,
    code: string,
    options: { transactionId?: string } = {},
  ): Promise<
    | { success: true; summa: number; messageId?: string | number; rawResponse: any }
    | { success: false; explicitRejection: true; message: string; httpStatus: number; rawResponse: any }
    | { success: false; explicitRejection: false; uncertain: true; message: string; httpStatus: number; error?: string }
  > {
    const { hash, cashierpass, cashdeskid } = this.getConfig();
    const { sign, confirm } = this.computePayoutSignature(hash, cashierpass, cashdeskid, userId, code);
    const url = `${BASE_URL}/Deposit/${userId}/Payout`;
    const body = { cashdeskId: parseInt(cashdeskid), lng: "fr", code, confirm };

    const lire = (data: any, cle: string) =>
      data && typeof data === "object"
        ? data[cle] ?? data[cle.charAt(0).toUpperCase() + cle.slice(1)]
        : undefined;

    let httpStatus = 0;
    let data: any = null;
    let erreurReseau: string | null = null;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { sign, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      httpStatus = res.status;
      data = await res.json().catch(() => null);
    } catch (error: any) {
      erreurReseau = error?.message || String(error);
    }

    // Journalisation sans jamais exposer le code de retrait en clair (code masqué: ***)
    if (options.transactionId) {
      await TransactionRepository.logApiCall({
        transactionId: options.transactionId,
        provider: "xbet",
        endpoint: `/Deposit/${userId}/Payout`,
        httpStatus: httpStatus || 0,
        requestPayload: { cashdeskId: parseInt(cashdeskid), lng: "fr", code: "***", confirm },
        responsePayload: data ?? { error: erreurReseau },
      }).catch(console.error);
    }

    // Succès confirmé
    if (httpStatus >= 200 && httpStatus < 300 && lire(data, "success") === true) {
      const summaRaw = lire(data, "summa");
      const summa = summaRaw !== undefined ? Math.abs(Number(summaRaw)) : NaN;
      const messageId = lire(data, "messageId");
      return { success: true, summa, messageId, rawResponse: data };
    }

    // Refus explicite (Success: false avec motif)
    if (data && lire(data, "success") === false) {
      const msg = lire(data, "message") || "Code de retrait refusé par 1XBET";
      return { success: false, explicitRejection: true, message: String(msg), httpStatus, rawResponse: data };
    }

    // Erreur réseau ou timeout : résultat INCERTAIN, AUCUN virement
    const detail = erreurReseau || (httpStatus ? `HTTP ${httpStatus}` : "Pas de réponse");
    return {
      success: false,
      explicitRejection: false,
      uncertain: true,
      message: `RÉSULTAT INCERTAIN : vérifier la caisse 1XBET avant tout virement (${detail})`,
      httpStatus,
      error: erreurReseau || undefined,
    };
  }
}
