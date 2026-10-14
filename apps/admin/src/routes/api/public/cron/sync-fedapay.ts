import { createFileRoute } from "@tanstack/react-router";
import { loadServerEnv } from "@/server/server-env";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { FedaPay, Transaction } from "fedapay";
import { FedaPayAdapter } from "@/server/adapters/FedaPayAdapter";
import { DepositOrchestrator } from "@/server/orchestrators/DepositOrchestrator.server";

// Format actuel de TanStack Start (server.handlers) : l'ancien `export const APIRoute` était
// ignoré par la compilation, la route répondait 404 en production (2026-10-13).
export const Route = createFileRoute("/api/public/cron/sync-fedapay")({
  server: {
    handlers: {
  GET: async ({ request }: { request: Request }) => {
    try {
      // Security: Cron should ideally be protected by a secret token
      // Route publique : le secret est OBLIGATOIRE (sans lui, n'importe qui la déclenche).
      const authHeader = request.headers.get("Authorization");
      if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response("Unauthorized", { status: 401 });
      }

      // Configure FedaPay
      // @ts-ignore - access private configure for simplicity or just call a public method if exists
      // FedaPayAdapter.configure(); // we will just use process.env here directly if needed
      const key = process.env.FEDAPAY_SECRET_KEY;
      if (key) {
        FedaPay.setApiKey(key);
        FedaPay.setEnvironment(key.startsWith("sk_live") ? "live" : "sandbox");
      }

      // 1. Fetch pending deposits older than 5 minutes
      // 1 min (et non 5) : si le webhook FedaPay manque, le client est crédité en 1 à 2 min.
      // Sans risque : on relit le statut réel chez FedaPay, et le crédit est fait une seule fois.
      const fiveMinsAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
      
      const { data: pendingTx, error } = await supabaseAdmin
        .from("transactions")
        .select("*")
        // L'app crée ses dépôts en `awaiting_payment` : ne lire que `pending` ne trouvait rien.
        .in("status", ["pending", "awaiting_payment"])
        .eq("type", "recharge")
        .lt("created_at", fiveMinsAgo)
        .not("provider_ref", "is", null)
        .limit(50);

      if (error) throw error;
      
      let synced = 0;
      for (const tx of (pendingTx || [])) {
        try {
          const fedaTx = await Transaction.retrieve(tx.provider_ref);
          if (fedaTx.status === "approved") {
            // Trigger the exact same logic as webhook
            await DepositOrchestrator.handleAggregatorWebhook({
              reference: tx.id,
              status: "successful", // our internal mapping
              amount: fedaTx.amount,
              rawPayload: fedaTx
            }, "", { verifiedByProviderApi: true }); // statut relu chez FedaPay : il fait foi
            synced++;
          } else if (fedaTx.status === "declined" || fedaTx.status === "canceled") {
            await supabaseAdmin.from("transactions").update({ status: "rejected" }).eq("id", tx.id);
            synced++;
          }
        } catch (e) {
          console.error(`Error syncing tx ${tx.id}`, e);
        }
      }

      // 2. Relire les retraits en statut 'crediting' pour vérifier le statut réel du virement FedaPay
      const { data: creditingWithdrawals, error: errW } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("status", "crediting")
        .eq("type", "withdrawal")
        .not("provider_ref", "is", null)
        .limit(50);

      if (errW) {
        console.error("Error fetching crediting withdrawals", errW);
      } else {
        for (const tx of (creditingWithdrawals || [])) {
          try {
            const payout = await Payout.retrieve(tx.provider_ref);
            const status = String(payout?.status || "").toLowerCase();
            // Statut FedaPay payout : 'sent' (ou approved) -> validated + credited_at
            if (status === "sent" || status === "approved" || status === "successful") {
              await supabaseAdmin.from("transactions").update({
                status: "validated",
                credited_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }).eq("id", tx.id);
              synced++;
            } else if (status === "failed" || status === "declined" || status === "canceled" || status === "rejected") {
              // 'failed' -> failed_credit
              await supabaseAdmin.from("transactions").update({
                status: "failed_credit",
                failure_reason: `Virement FedaPay échoué (${payout?.status || "failed"})`,
                updated_at: new Date().toISOString(),
              }).eq("id", tx.id);
              synced++;
            }
          } catch (e) {
            console.error(`Error syncing withdrawal payout for tx ${tx.id}`, e);
          }
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        synced, 
        total_checked: (pendingTx?.length || 0) + (creditingWithdrawals?.length || 0) 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      console.error("[Cron Sync Error]", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
    },
  },
});
