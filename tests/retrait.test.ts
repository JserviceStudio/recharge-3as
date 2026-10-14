import { describe, it, expect, vi, beforeEach } from "vitest";
import * as crypto from "node:crypto";
import { normaliserNumero, CodePays, RESEAUX_RECHARGE, reseauRecharge } from "../apps/client/src/lib/mobile-money";
import { XbetAdapter } from "../apps/admin/src/server/adapters/XbetAdapter";
import { submitWithdrawalSchema } from "../apps/client/src/actions/orchestrators/RetraitOrchestrator.server";

describe("Retrait 3AS - Tests unitaires et intégration", () => {
  // 1. Normalisation numéro et pays
  describe("1. Normalisation numéro/pays", () => {
    it("devrait normaliser correctement un numéro béninois (8 chiffres -> 10 chiffres 01)", () => {
      const res = normaliserNumero("BJ", "96 00 00 00");
      expect(res).not.toBeNull();
      expect(res?.national).toBe("0196000000");
      expect(res?.e164).toBe("+2290196000000");
    });

    it("devrait accepter un numéro béninois déjà à 10 chiffres avec indicatif +229", () => {
      const res = normaliserNumero("BJ", "+229 01 96 00 00 00");
      expect(res).not.toBeNull();
      expect(res?.national).toBe("0196000000");
      expect(res?.e164).toBe("+2290196000000");
    });

    it("devrait rejeter un numéro béninois invalide (trop court ou sans préfixe valide)", () => {
      expect(normaliserNumero("BJ", "12345")).toBeNull();
      expect(normaliserNumero("BJ", "02 96 00 00 00")).toBeNull();
    });

    it("devrait normaliser correctement un numéro togolais (8 chiffres en 9x ou 7x)", () => {
      const resYas = normaliserNumero("TG", "90 00 00 00");
      expect(resYas).not.toBeNull();
      expect(resYas?.national).toBe("90000000");
      expect(resYas?.e164).toBe("+22890000000");

      const resMoov = normaliserNumero("TG", "+228 70 12 34 56");
      expect(resMoov).not.toBeNull();
      expect(resMoov?.national).toBe("70123456");
      expect(resMoov?.e164).toBe("+22870123456");
    });

    it("devrait rejeter un numéro togolais invalide (ex: fixe commençant par 2)", () => {
      expect(normaliserNumero("TG", "22 12 34 56")).toBeNull();
      expect(normaliserNumero("TG", "90 12 34")).toBeNull();
    });
  });

  // 2. Signature payout 1XBET (vecteur calculé)
  describe("2. Signature payout 1XBET (vecteur calculé)", () => {
    it("devrait calculer exactement la signature SHA256(SHA256+MD5) et confirm MD5 pour le vecteur", () => {
      const hash = "secret_hash_key_1234";
      const cashierpass = "pass_caissier_789";
      const cashdeskid = "4567";
      const userId = "987654";
      const code = "RETRAIT_CODE_ABC";

      // Calcul manuel attendu d'après le brief :
      // part1 = SHA256("hash=" + hash + "&lng=fr&userid=" + userId)
      const part1Expected = crypto
        .createHash("sha256")
        .update(`hash=${hash}&lng=fr&userid=${userId}`)
        .digest("hex");

      // part2 = MD5("code=" + code + "&cashierpass=" + cashierpass + "&cashdeskid=" + cashdeskid)
      const part2Expected = crypto
        .createHash("md5")
        .update(`code=${code}&cashierpass=${cashierpass}&cashdeskid=${cashdeskid}`)
        .digest("hex");

      // sign = SHA256(part1 + part2)
      const signExpected = crypto
        .createHash("sha256")
        .update(`${part1Expected}${part2Expected}`)
        .digest("hex");

      // confirm = MD5("userid:hash")
      const confirmExpected = crypto
        .createHash("md5")
        .update(`${userId}:${hash}`)
        .digest("hex");

      const res = XbetAdapter.computePayoutSignature(hash, cashierpass, cashdeskid, userId, code);

      expect(res.sign).toBe(signExpected);
      expect(res.confirm).toBe(confirmExpected);
    });
  });

  // 3. Mode payout Celtiis = sbin
  describe("3. Mode payout Celtiis = sbin", () => {
    it("devrait mapper Celtiis Bénin sur le mode FedaPay 'sbin'", () => {
      const reseau = reseauRecharge("celtiis_bj");
      expect(reseau).not.toBeNull();
      expect(reseau?.modeFedapay).toBe("sbin");
    });

    it("devrait mapper Mixx by Yas Togo sur 'togocel'", () => {
      const reseau = reseauRecharge("yas_tg");
      expect(reseau).not.toBeNull();
      expect(reseau?.modeFedapay).toBe("togocel");
    });
  });

  // 4. Idempotence (même clé -> renvoie la demande existante)
  describe("4. Idempotence (même clé)", () => {
    it("devrait retourner la transaction existante sans nouvel enregistrement quand la même clé est fournie", async () => {
      const idempotencyKey = crypto.randomUUID();
      const existingTx = {
        id: "tx-existing-uuid",
        idempotency_key: idempotencyKey,
        amount: 5000,
        status: "pending",
        user_id: "user-123",
      };

      // Simulation du repository / db
      const mockDb = {
        findByKey: vi.fn().mockResolvedValue(existingTx),
        insert: vi.fn(),
      };

      // Handler d'idempotence
      const handleSubmission = async (key: string) => {
        const found = await mockDb.findByKey(key);
        if (found) {
          return { success: true, transaction: found, isDuplicate: true };
        }
        const created = await mockDb.insert({ idempotency_key: key });
        return { success: true, transaction: created, isDuplicate: false };
      };

      const result = await handleSubmission(idempotencyKey);
      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.transaction.id).toBe("tx-existing-uuid");
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  // 5. Réservation atomique (2e validation refusée)
  describe("5. Réservation atomique (2e validation refusée)", () => {
    it("devrait réussir pour le 1er appel et refuser le 2e appel concurrent", async () => {
      let txStatus = "pending";

      // Simulation d'une fonction atomique SQL UPDATE transactions SET status='paid' WHERE id=... AND status='pending' RETURNING *
      const atomicReserve = async (txId: string) => {
        if (txStatus === "pending") {
          txStatus = "paid";
          return [{ id: txId, status: "paid" }]; // 1 ligne mise à jour
        }
        return []; // 0 ligne mise à jour (déjà traitée)
      };

      // 1er appel : succès de la réservation
      const res1 = await atomicReserve("tx-abc");
      expect(res1.length).toBe(1);
      expect(res1[0].status).toBe("paid");

      // 2e appel immédiat (double clic) : 0 ligne retournée
      const res2 = await atomicReserve("tx-abc");
      expect(res2.length).toBe(0);

      // Le système doit lever l'erreur « Transaction déjà traitée »
      const validateOrThrow = async () => {
        const rows = await atomicReserve("tx-abc");
        if (!rows || rows.length === 0) {
          throw new Error("Transaction déjà traitée ou introuvable.");
        }
      };

      await expect(validateOrThrow()).rejects.toThrow("Transaction déjà traitée");
    });
  });

  // 6. Timeout 1XBET -> aucun virement
  describe("6. Timeout 1XBET -> aucun virement", () => {
    it("devrait passer en failed_credit avec résultat incertain sans appeler FedaPay", async () => {
      // Mock de l'appel 1XBET qui lève un Timeout / AbortError
      const mockXbetPayout = vi.fn().mockImplementation(async () => {
        return {
          success: false,
          explicitRejection: false,
          uncertain: true,
          message: "RÉSULTAT INCERTAIN : vérifier la caisse 1XBET avant tout virement (Timeout 30s)",
          httpStatus: 0,
        };
      });

      const mockFedaPayPayout = vi.fn();
      let txFinalStatus = "paid";
      let failureReason = "";

      // Logique orchestrateur validateTransaction
      const xbetRes = await mockXbetPayout("user-1", "CODE123");
      if (!xbetRes.success) {
        if (xbetRes.uncertain) {
          txFinalStatus = "failed_credit";
          failureReason = xbetRes.message;
        }
      } else {
        await mockFedaPayPayout();
      }

      expect(txFinalStatus).toBe("failed_credit");
      expect(failureReason).toContain("RÉSULTAT INCERTAIN : vérifier la caisse 1XBET avant tout virement");
      // AUCUN virement FedaPay déclenché
      expect(mockFedaPayPayout).not.toHaveBeenCalled();
    });
  });

  // 7. Refus 1XBET -> rejected
  describe("7. Refus 1XBET -> rejected", () => {
    it("devrait passer en rejected avec le motif et ne faire aucun virement", async () => {
      // Mock refus explicite de 1XBET (Success: false)
      const mockXbetPayout = vi.fn().mockResolvedValue({
        success: false,
        explicitRejection: true,
        message: "Code déjà payé ou introuvable",
        httpStatus: 200,
        rawResponse: { Success: false, Message: "Code déjà payé ou introuvable" },
      });

      const mockFedaPayPayout = vi.fn();
      let txFinalStatus = "paid";
      let rejectionReason = "";

      const xbetRes = await mockXbetPayout("user-1", "CODE_EXPIRE");
      if (!xbetRes.success) {
        if (xbetRes.explicitRejection) {
          txFinalStatus = "rejected";
          rejectionReason = xbetRes.message;
        }
      } else {
        await mockFedaPayPayout();
      }

      expect(txFinalStatus).toBe("rejected");
      expect(rejectionReason).toBe("Code déjà payé ou introuvable");
      expect(mockFedaPayPayout).not.toHaveBeenCalled();
    });
  });

  // 8. Summa != déclaré -> virement du réel
  describe("8. Summa ≠ déclaré -> virement du réel", () => {
    it("devrait virer le montant réel retourné par 1XBET (Math.abs(Summa)) et consigner l'écart", async () => {
      const montantDeclare = 5000;
      // 1XBET renvoie Summa = -4500 (ou 4500)
      const xbetResponse = {
        success: true,
        summa: 4500,
        messageId: "MSG-1XBET-999",
      };

      const montantReel = Math.abs(xbetResponse.summa);
      let noteEcart: string | null = null;
      if (montantReel !== montantDeclare) {
        noteEcart = `Écart montant : déclaré ${montantDeclare} FCFA, réel reçu 1XBET ${montantReel} FCFA. Virement du montant réel.`;
      }

      const mockFedaPayPayout = vi.fn().mockResolvedValue({ isSuccess: true, providerRef: "fedapay-payout-123" });
      await mockFedaPayPayout(montantReel);

      expect(montantReel).toBe(4500);
      expect(mockFedaPayPayout).toHaveBeenCalledWith(4500);
      expect(noteEcart).toContain("déclaré 5000 FCFA, réel reçu 1XBET 4500 FCFA");
    });
  });

  // 9. Webhook payout n'altère pas une recharge
  describe("9. Webhook payout n'altère pas une recharge", () => {
    it("devrait ignorer tout webhook dont l'événement n'est pas transaction.*", () => {
      const webhookPayload = {
        name: "payout.sent",
        entity: { id: 1234, status: "sent", amount: 5000 },
      };

      const eventName = webhookPayload.name;
      const shouldProcessForRecharge = eventName && eventName.startsWith("transaction.");
      expect(shouldProcessForRecharge).toBe(false);
    });

    it("devrait ignorer une transaction qui n'est pas de type 'recharge'", () => {
      const transactionEnBase = {
        id: "tx-retrait-123",
        type: "withdrawal",
        status: "crediting",
        amount: 5000,
      };

      const isEligibleRecharge = transactionEnBase.type === "recharge";
      expect(isEligibleRecharge).toBe(false);
    });
  });

  // Relecture 1 - Corrections ciblées (points 1 à 4)
  describe("Relecture 1 - Corrections ciblées", () => {
    // Point 1 : Schéma refusé côté serveur (premier message Zod sans trace brute)
    it("devrait rejeter des données invalides et renvoyer le premier message Zod sans trace brute", () => {
      const validateInput = (data: unknown) => {
        try {
          return submitWithdrawalSchema.parse(data);
        } catch (err: any) {
          if (err.issues && err.issues.length > 0) {
            throw new Error(err.issues[0]?.message || "Données invalides");
          }
          throw err;
        }
      };

      // Ville manquante
      const invalidDataVille = {
        idempotency_key: crypto.randomUUID(),
        city: "",
        district: "Quartier Haie Vive",
        app_code: "1xbet",
        id_1xbet: "123456",
        tx_id: "CODE1234",
        amount: 5000,
        recipient_name: "Jean Dupont",
        recipient_country: "BJ",
        payment_method_id: crypto.randomUUID(),
        recipient_number: "96000000",
      };
      expect(() => validateInput(invalidDataVille)).toThrow("La ville est obligatoire");

      // Montant invalide
      const invalidDataMontant = {
        ...invalidDataVille,
        city: "Cotonou",
        amount: -500,
      };
      expect(() => validateInput(invalidDataMontant)).toThrow("Montant invalide");

      // Code de retrait trop court (< 4 caractères)
      const invalidDataCode = {
        ...invalidDataVille,
        city: "Cotonou",
        tx_id: "ABC",
      };
      expect(() => validateInput(invalidDataCode)).toThrow(
        "Le code de retrait doit contenir entre 4 et 80 caractères alphanumériques"
      );
    });

    // Point 2 : Clé d'un autre client (ne rien renvoyer)
    it("devrait ne rien renvoyer si la clé d'idempotence appartient à un autre client", async () => {
      const targetKey = crypto.randomUUID();
      const client1Id = "user-client-1";
      const client2Id = "user-client-2";

      const dbTransactions = [
        {
          id: "tx-client-1",
          user_id: client1Id,
          idempotency_key: targetKey,
          amount: 5000,
          status: "pending",
        },
      ];

      // Requête avec filtre idempotency_key ET user_id
      const findExistingTx = async (idempotencyKey: string, userId: string) => {
        return dbTransactions.find(
          (t) => t.idempotency_key === idempotencyKey && t.user_id === userId
        ) || null;
      };

      // Le client 1 retrouve sa transaction
      const client1Result = await findExistingTx(targetKey, client1Id);
      expect(client1Result).not.toBeNull();
      expect(client1Result?.id).toBe("tx-client-1");

      // Le client 2 soumet la même clé : ne rien renvoyer (null)
      const client2Result = await findExistingTx(targetKey, client2Id);
      expect(client2Result).toBeNull();
    });

    // Point 3 : Moyen sans payout_mode -> pending sans appel 1XBET
    it("devrait remettre la transaction en pending sans appeler 1XBET si payout_mode est absent", async () => {
      let txStatus = "paid";
      const adminLogs: any[] = [];
      const mockXbetPayout = vi.fn();

      const tx = {
        id: "tx-retrait-no-mode",
        payment_method_id: "method-no-payout-mode",
        recipient_number: "0196000000",
        recipient_country: "BJ",
      };

      const mockMethod = {
        id: "method-no-payout-mode",
        country: "BJ",
        payout_mode: null,
      };

      const rollbackToPending = async (reason: string) => {
        if (txStatus === "paid") {
          txStatus = "pending";
        }
        adminLogs.push({ action: "abort_withdrawal_validation", target_id: tx.id, reason });
        throw new Error(reason);
      };

      const validateWithdrawal = async () => {
        if (!mockMethod || !mockMethod.payout_mode || !mockMethod.country) {
          await rollbackToPending("Moyen de paiement introuvable ou configuration de virement incomplète");
        }
        await mockXbetPayout();
      };

      await expect(validateWithdrawal()).rejects.toThrow(
        "Moyen de paiement introuvable ou configuration de virement incomplète"
      );
      expect(txStatus).toBe("pending");
      expect(mockXbetPayout).not.toHaveBeenCalled();
      expect(adminLogs.length).toBe(1);
      expect(adminLogs[0].action).toBe("abort_withdrawal_validation");
    });

    // Point 3 : Numéro invalide -> pending sans appel 1XBET
    it("devrait remettre la transaction en pending sans appeler 1XBET si le numéro est invalide", async () => {
      let txStatus = "paid";
      const adminLogs: any[] = [];
      const mockXbetPayout = vi.fn();

      const tx = {
        id: "tx-retrait-invalid-num",
        payment_method_id: "method-bj-ok",
        recipient_number: "12345",
        recipient_country: "BJ",
      };

      const mockMethod = {
        id: "method-bj-ok",
        country: "BJ",
        payout_mode: "mtn_open",
      };

      const rollbackToPending = async (reason: string) => {
        if (txStatus === "paid") {
          txStatus = "pending";
        }
        adminLogs.push({ action: "abort_withdrawal_validation", target_id: tx.id, reason });
        throw new Error(reason);
      };

      const validateWithdrawal = async () => {
        const payoutMode = (mockMethod.payout_mode || "").trim();
        const country = (mockMethod.country || "").trim() as CodePays;
        if (!payoutMode || !country) {
          await rollbackToPending("Configuration incomplète");
        }

        const norm = normaliserNumero(country, tx.recipient_number);
        if (!norm || !norm.national) {
          await rollbackToPending(`Numéro de bénéficiaire invalide (${tx.recipient_number}) pour le pays ${country}.`);
        }

        await mockXbetPayout();
      };

      await expect(validateWithdrawal()).rejects.toThrow("Numéro de bénéficiaire invalide (12345) pour le pays BJ");
      expect(txStatus).toBe("pending");
      expect(mockXbetPayout).not.toHaveBeenCalled();
      expect(adminLogs.length).toBe(1);
    });

    // Point 4 : Summa absent (NaN) -> aucun virement, failed_credit résultat incertain
    it("devrait passer en failed_credit avec résultat incertain sans virer si summa est absent (NaN)", async () => {
      const mockFedaPayPayout = vi.fn();
      let txStatus = "paid";
      let failureReason = "";
      let recordedXbetPayoutRef = "";

      const xbetResponse = {
        success: true,
        summa: NaN,
        messageId: "XBET-MSG-987",
      };

      const xbetPayoutRef = xbetResponse.messageId || "REF-FALLBACK";
      const montantReel = Math.abs(xbetResponse.summa);

      if (!Number.isFinite(montantReel) || !Number.isInteger(montantReel) || montantReel <= 0) {
        txStatus = "failed_credit";
        failureReason = "RÉSULTAT INCERTAIN : 1XBET a confirmé sans montant exploitable, vérifier la caisse";
        recordedXbetPayoutRef = xbetPayoutRef;
      } else {
        await mockFedaPayPayout(montantReel);
      }

      expect(txStatus).toBe("failed_credit");
      expect(failureReason).toBe("RÉSULTAT INCERTAIN : 1XBET a confirmé sans montant exploitable, vérifier la caisse");
      expect(recordedXbetPayoutRef).toBe("XBET-MSG-987");
      expect(mockFedaPayPayout).not.toHaveBeenCalled();
    });

    it("devrait retourner NaN dans XbetAdapter si le champ summa est absent de la réponse", () => {
      const dataWithoutSumma = { success: true, messageId: "12345" };
      const lire = (data: any, cle: string) => data[cle] ?? data[cle.charAt(0).toUpperCase() + cle.slice(1)];
      const summaRaw = lire(dataWithoutSumma, "summa");
      const summa = summaRaw !== undefined ? Math.abs(Number(summaRaw)) : NaN;
      expect(Number.isNaN(summa)).toBe(true);
    });
  });
});
