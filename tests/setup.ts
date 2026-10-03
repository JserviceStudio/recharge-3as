import { beforeAll, vi } from "vitest";

beforeAll(() => {
  // Configurer des variables d'environnement fictives pour les tests
  process.env.FEDAPAY_SECRET_KEY = "sk_sandbox_test";
  process.env.FEDAPAY_WEBHOOK_SECRET = "wh_sec_test";
  process.env.XBET_HASH = "test_hash";
  process.env.XBET_CASHIERPASS = "test_pass";
  process.env.XBET_CASHDESKID = "test_id";
});
