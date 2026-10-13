import { describe, it, expect, vi, beforeEach } from "vitest";
import { XbetAdapter } from "../apps/admin/src/server/adapters/XbetAdapter";
import { TransactionRepository } from "../apps/admin/src/server/repositories/TransactionRepository";

global.fetch = vi.fn();
vi.mock("../apps/admin/src/server/repositories/TransactionRepository");

// Règles 2026-10-13 : un dépôt n'est JAMAIS rejoué automatiquement (crédit multiple), la réponse
// 1xBet est en PascalCase, et la signature de vérification utilise `userid` en minuscules.
describe("XbetAdapter", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("dépôt : succès en minuscules → validé, un seul appel", async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, messageId: "1" }) });
    expect(await XbetAdapter.creditAccountWithRetry("TX_1", 1000, "12345", "REF")).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("dépôt : succès en PascalCase (Success) → validé", async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ Success: true, MessageId: 9 }) });
    expect(await XbetAdapter.creditAccountWithRetry("TX_2", 1000, "12345", "REF")).toBe(true);
    expect(TransactionRepository.updateStatus).toHaveBeenCalledWith("TX_2", "validated", expect.objectContaining({ xbet_credit_ref: "9" }));
  });

  it("dépôt : refus explicite → failed_credit, aucun nouvel essai", async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ Success: false, Message: "Solde insuffisant" }) });
    expect(await XbetAdapter.creditAccountWithRetry("TX_3", 1000, "12345", "REF")).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(TransactionRepository.updateStatus).toHaveBeenCalledWith("TX_3", "failed_credit", expect.objectContaining({ failure_reason: expect.stringContaining("Solde insuffisant") }));
  });

  it("dépôt : erreur réseau → INCERTAIN, aucun nouvel essai", async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error("timeout"));
    expect(await XbetAdapter.creditAccountWithRetry("TX_4", 1000, "12345", "REF")).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(TransactionRepository.updateStatus).toHaveBeenCalledWith("TX_4", "failed_credit", expect.objectContaining({ failure_reason: expect.stringContaining("INCERTAIN") }));
  });

  it("vérification : réponse PascalCase (UserId) → compte valide", async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ UserId: 624206417, Name: "X" }) });
    expect(await XbetAdapter.verifyAccount("624206417")).toBe(true);
  });
});
