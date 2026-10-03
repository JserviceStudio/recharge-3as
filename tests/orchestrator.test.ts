import { describe, it, expect, vi, beforeEach } from "vitest";
import { DepositOrchestrator } from "../src/server/orchestrators/DepositOrchestrator.server";
import { TransactionRepository } from "../src/server/repositories/TransactionRepository";
import { FedaPayAdapter } from "../src/server/adapters/FedaPayAdapter";
import { XbetAdapter } from "../src/server/adapters/XbetAdapter";

// Mocks
vi.mock("../src/server/repositories/TransactionRepository");
vi.mock("../src/server/adapters/FedaPayAdapter");
vi.mock("../src/server/adapters/XbetAdapter");

describe("DepositOrchestrator - Machine à états (Workflow)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("devrait créer une transaction en attente et renvoyer une URL de paiement FedaPay", async () => {
    // Setup Mocks
    const mockTx = { id: "tx_1", status: "pending", amount: 1000 };
    (XbetAdapter.verifyAccount as any).mockResolvedValue(true);
    (TransactionRepository.createTransaction as any).mockResolvedValue(mockTx);
    (FedaPayAdapter.createPaymentRequest as any).mockResolvedValue({
      isSuccess: true,
      providerRef: "fedapay_123",
      checkoutUrl: "https://pay.fedapay.com/xxx"
    });

    const payload = {
      userId: "user_1",
      id1xbet: "12345",
      amount: 1000,
      paymentMethodId: "method_1",
      paymentMethodLabel: "MTN",
      userPhone: "00000000"
    };

    const result = await DepositOrchestrator.initiateDeposit(payload);

    // Assertions
    expect(TransactionRepository.createTransaction).toHaveBeenCalled();
    expect(FedaPayAdapter.createPaymentRequest).toHaveBeenCalledWith(payload, "tx_1", expect.any(String));
    expect(TransactionRepository.updateStatus).toHaveBeenCalledWith("tx_1", "awaiting_payment", { provider_ref: "fedapay_123" });
    
    expect(result.checkoutUrl).toBe("https://pay.fedapay.com/xxx");
    expect(result.tx).toEqual(mockTx);
  });

  it("devrait passer la transaction en successful et créditer 1XBET lors de la réception d'un Webhook valide", async () => {
    // Mock Transaction exists
    const mockTx = { id: "tx_1", status: "awaiting_payment", amount: 1000, id_1xbet: "12345" };
    (TransactionRepository.getByProviderRef as any).mockResolvedValue(mockTx);
    
    // Mock signature = valide
    (FedaPayAdapter.verifyWebhookSignature as any).mockReturnValue(true);
    
    // Mock 1XBET success
    (XbetAdapter.creditAccountWithRetry as any).mockResolvedValue(true);

    const webhookPayload = {
      rawPayload: { entity: { id: "fedapay_123", status: "approved", amount: 1000 } },
      signature: "valid_signature",
      reference: "fedapay_123"
    };

    await DepositOrchestrator.handleAggregatorWebhook(webhookPayload, "valid_signature");

    // Vérifier que la vérification de signature a été appelée
    expect(FedaPayAdapter.verifyWebhookSignature).toHaveBeenCalled();
    
    // Vérifier que le statut est mis à jour
    expect(TransactionRepository.updateStatus).toHaveBeenCalledWith("tx_1", "paid", { provider_status: "successful" });

    // Vérifier que 1XBET a été crédité
    expect(XbetAdapter.creditAccountWithRetry).toHaveBeenCalledWith("tx_1", 1000, "12345", "fedapay_123");
  });

  it("devrait bloquer un Webhook avec une mauvaise signature", async () => {
    (FedaPayAdapter.verifyWebhookSignature as any).mockReturnValue(false);

    const webhookPayload = {
      rawPayload: { entity: { id: "fedapay_123", status: "approved" } },
      signature: "invalid_signature"
    };

    // Doit jeter une erreur de signature
    await expect(DepositOrchestrator.handleAggregatorWebhook(webhookPayload))
      .rejects.toThrow("Signature Webhook Invalide");
      
    // Ne doit PAS mettre à jour la BDD
    expect(TransactionRepository.updateStatus).not.toHaveBeenCalled();
    expect(XbetAdapter.creditAccountWithRetry).not.toHaveBeenCalled();
  });
});
