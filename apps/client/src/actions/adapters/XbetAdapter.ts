import { TransactionRepository } from "../repositories/TransactionRepository";
import * as crypto from "node:crypto";

const BASE_URL = "https://partners.servcul.com/CashdeskBotAPI";

export class XbetAdapter {
  private static getConfig() {
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
    console.log(`[XbetService] MOCK Vérification du compte ${id1xbet}... (Bypass dev)`);
    return true; // Bypass dev
    
    try {
      const { hash, cashierpass, cashdeskid } = this.getConfig();

      const confirm = this.md5(`${id1xbet}:${hash}`);

      // Formation de la signature
      // 1. SHA256(hash={0}&userId={1}&cashdeskid={2})
      const part1 = this.sha256(`hash=${hash}&userId=${id1xbet}&cashdeskid=${cashdeskid}`);
      // 2. MD5(userId={0}&cashierpass={1}&hash={2})
      const part2 = this.md5(`userId=${id1xbet}&cashierpass=${cashierpass}&hash=${hash}`);
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
      
      // Si on a un nom ou userId dans la réponse, c'est bon
      if (data && data.userId) {
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
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [5000, 30000, 120000]; // 5s, 30s, 2m

    const { hash, cashierpass, cashdeskid } = this.getConfig();
    const lng = "fr";

    // Formatage du montant (les APIs nécessitent parfois des entiers ou decimals, on s'assure d'un format propre)
    // On suppose que amount est déjà un entier pour les FCFA, mais on l'assure au cas où.
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
    const body = {
      cashdeskid: parseInt(cashdeskid),
      lng,
      summa,
      confirm
    };

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[XbetAdapter] Tentative de crédit ${attempt}/${MAX_RETRIES} pour TX ${transactionId}...`);
        
        await TransactionRepository.updateStatus(transactionId, "crediting", { credit_attempts: attempt });

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "sign": sign,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        const data = await res.json().catch(() => null);

        // 200 OK avec payload success
        if (res.ok && data?.success === true) {
          const xbetCreditRef = data.messageId ? String(data.messageId) : `XBET-OK-${Date.now()}`;

          await TransactionRepository.updateStatus(transactionId, "validated", {
            xbet_credit_ref: xbetCreditRef,
            credited_at: new Date().toISOString()
          });

          await TransactionRepository.logApiCall({
            transactionId,
            provider: "xbet",
            endpoint: `/Deposit/${id1xbet}/Add`,
            httpStatus: res.status,
            responsePayload: data
          });

          console.log(`[XbetAdapter] Crédit réussi pour TX ${transactionId}`);
          return true;
        }

        // Si ce n'est pas un succès
        throw new Error(`Erreur API 1XBET (HTTP ${res.status}): ${data?.message || 'Inconnue'}`);

      } catch (error: any) {
        console.error(`[XbetAdapter] Échec tentative ${attempt}:`, error.message);
        
        await TransactionRepository.logApiCall({
          transactionId,
          provider: "xbet",
          endpoint: `/Deposit/${id1xbet}/Add`,
          httpStatus: 500,
          responsePayload: { error: error.message }
        });

        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt - 1]));
        } else {
          await TransactionRepository.updateStatus(transactionId, "failed_credit", {
            failure_reason: `Échec après ${MAX_RETRIES} tentatives: ${error.message}`
          });
          console.error(`[XbetAdapter] Abandon, passage en failed_credit pour TX ${transactionId}`);
          return false;
        }
      }
    }
  }
}
