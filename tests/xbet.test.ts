import { describe, it, expect, vi, beforeEach } from "vitest";
import { XbetAdapter } from "../src/server/adapters/XbetAdapter";
import { TransactionRepository } from "../src/server/repositories/TransactionRepository";

// Mocking fetch globally
global.fetch = vi.fn();

// Mock TransactionRepository
vi.mock("../src/server/repositories/TransactionRepository");

describe("XbetAdapter - Résilience & Algorithme de Retry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("devrait retourner un succès si l'API répond 200 à la première tentative", async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, messageId: "123456" }),
    });

    const success = await XbetAdapter.creditAccountWithRetry("TX_1", 1000, "12345", "FEDAPAY_123");
    expect(success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("devrait réessayer et réussir si l'API échoue la 1ère fois mais réussit la 2ème", async () => {
    (global.fetch as any)
      .mockRejectedValueOnce(new Error("Network Error")) // 1er appel échoue
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, messageId: "123456" }),
      }); // 2ème appel réussit

    // On mock les timers pour éviter d'attendre vraiment 5 secondes pendant le test
    vi.useFakeTimers();
    
    // On lance la fonction
    const promise = XbetAdapter.creditAccountWithRetry("TX_1", 1000, "12345", "FEDAPAY_123");
    
    // On avance le temps pour dépasser le 1er délai (5000ms)
    await vi.advanceTimersByTimeAsync(5000);
    
    const success = await promise;
    expect(success).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2); // 1er échec, 2ème réussite
    
    vi.useRealTimers();
  });

  it("devrait échouer après toutes les tentatives épuisées", async () => {
    // Toujours échouer
    (global.fetch as any).mockRejectedValue(new Error("Timeout API"));

    vi.useFakeTimers();
    const promise = XbetAdapter.creditAccountWithRetry("TX_1", 1000, "12345", "FEDAPAY_123");

    // Avancer le temps pour couvrir tous les retries (5s, 30s, 2m, 5m, etc.)
    await vi.advanceTimersByTimeAsync(1000000); 

    const success = await promise;
    expect(success).toBe(false);
    expect((global.fetch as any).mock.calls.length).toBeGreaterThan(1); // Doit avoir essayé plusieurs fois
    
    vi.useRealTimers();
  });
});
