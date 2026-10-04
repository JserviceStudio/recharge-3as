import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { DepositOrchestrator } from "../../actions/orchestrators/DepositOrchestrator.server";

// Attention: ce test tape sur la vraie base de données de développement et la vraie API FedaPay.
// Assurez-vous que l'environnement est bien configuré (clés Supabase et FedaPay dans .env).

describe("DepositOrchestrator E2E/Integration", () => {
  it("devrait vérifier le compte 1XBET, créer une transaction en base, et retourner une URL FedaPay", async () => {
    
    const supabase = createClient(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: user } = await supabase.from("profiles").select("id").limit(1).single();
    if (!user) throw new Error("Aucun utilisateur trouvé pour le test. Inscrivez au moins un utilisateur.");

    // On simule les données envoyées par le frontend
    const testPayload = {
      userId: user.id, // ID utilisateur réel récupéré de la base
      id1xbet: "123456789", // Le fameux ID de test
      amount: 100, // Montant minimum
      paymentMethodId: "fedapay-checkout", // Format non-UUID pour tester notre correctif
      paymentMethodLabel: "FedaPay",
      userPhone: "+2290196937864"
    };

    console.log("🚀 Lancement du test E2E de recharge pour l'utilisateur", user.id);
    
    const res = await DepositOrchestrator.initiateDeposit(testPayload);

    console.log("✅ Résultat obtenu :", res);

    // Assertions
    expect(res).toBeDefined();
    
    // On vérifie que la transaction a bien été créée dans Supabase
    expect(res.tx).toBeDefined();
    expect(res.tx.id).toBeDefined();
    expect(res.tx.status).toBe("awaiting_payment");
    expect(res.tx.amount).toBe(100);
    
    // On vérifie que FedaPay a bien renvoyé une URL de paiement
    expect(res.checkoutUrl).toBeDefined();
    expect(res.checkoutUrl).toContain("fedapay");
  }, 15000); // Timeout 15s au cas où les API sont lentes
});
