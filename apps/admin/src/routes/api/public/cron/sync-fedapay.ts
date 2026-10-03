import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { Transaction } from "fedapay";
import { FedaPayAdapter } from "@/server/adapters/FedaPayAdapter";
import { DepositOrchestrator } from "@/server/orchestrators/DepositOrchestrator.server";

export const APIRoute = {
  GET: async ({ request }: { request: Request }) => {
    try {
      // Security: Cron should ideally be protected by a secret token
      const authHeader = request.headers.get("Authorization");
      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Just a warning for now, or we can enforce it.
        // return new Response("Unauthorized", { status: 401 });
      }

      // Configure FedaPay
      // @ts-ignore - access private configure for simplicity or just call a public method if exists
      // FedaPayAdapter.configure(); // we will just use process.env here directly if needed
      const key = process.env.FEDAPAY_SECRET_KEY;
      if (key) {
        const { FedaPay } = require("fedapay");
        FedaPay.setApiKey(key);
        FedaPay.setEnvironment(key.startsWith("sk_live") ? "live" : "sandbox");
      }

      // 1. Fetch pending deposits older than 5 minutes
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      
      const { data: pendingTx, error } = await supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("status", "pending")
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
            }, "bypass-signature");
            synced++;
          } else if (fedaTx.status === "declined" || fedaTx.status === "canceled") {
            await supabaseAdmin.from("transactions").update({ status: "rejected" }).eq("id", tx.id);
            synced++;
          }
        } catch (e) {
          console.error(`Error syncing tx ${tx.id}`, e);
        }
      }

      return new Response(JSON.stringify({ success: true, synced, total_checked: pendingTx?.length || 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      console.error("[Cron Sync Error]", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }
};
