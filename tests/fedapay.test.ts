import { describe, it, expect } from "vitest";
import { FedaPayAdapter } from "../src/server/adapters/FedaPayAdapter";
import crypto from "node:crypto";

describe("FedaPayAdapter - Sécurité", () => {
  const secret = "wh_sec_test";
  const payload = {
    entity: {
      id: 1234,
      status: "approved",
      amount: 1000
    }
  };
  const payloadString = JSON.stringify(payload);

  it("devrait rejeter un webhook sans signature", () => {
    const isValid = FedaPayAdapter.verifyWebhookSignature(payloadString, "");
    expect(isValid).toBe(false);
  });

  it("devrait rejeter un webhook avec une signature invalide", () => {
    const fakeSignature = "t=123456,s=invalid_hash_string_that_is_not_64_chars";
    const isValid = FedaPayAdapter.verifyWebhookSignature(payloadString, fakeSignature);
    expect(isValid).toBe(false);
  });

  it("devrait accepter un webhook avec une signature HMAC SHA256 valide", () => {
    // FedaPay format v1 or s
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hash = crypto.createHmac("sha256", secret).update(timestamp + "." + payloadString).digest("hex");
    
    const signatureHeader = `t=${timestamp},s=${hash}`;
    const isValid = FedaPayAdapter.verifyWebhookSignature(payloadString, signatureHeader);
    expect(isValid).toBe(true);
  });

  it("devrait accepter un webhook avec un hash brut (raw)", () => {
    const hash = crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
    const isValid = FedaPayAdapter.verifyWebhookSignature(payloadString, hash);
    expect(isValid).toBe(true);
  });
});
