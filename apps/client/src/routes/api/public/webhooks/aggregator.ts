import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DepositOrchestrator } from "@/actions/orchestrators/DepositOrchestrator.server";
import { AggregatorWebhookPayload } from "@/types/backend";

// Format actuel de TanStack Start (server.handlers) : l'ancien `export const APIRoute` était
// ignoré par la compilation, la route répondait 404 en production (2026-10-13).
export const Route = createFileRoute("/api/public/webhooks/aggregator")({
  server: {
    handlers: {
  POST: async ({ request }: { request: Request }) => {
    try {
      // Corps EXACT : la signature FedaPay (en-tête x-fedapay-signature) porte sur ce texte.
      const rawBody = await request.text();
      const payload = JSON.parse(rawBody || "{}");
      const signature =
        request.headers.get("x-fedapay-signature") || request.headers.get("x-aggregator-signature") || "";
      
      const webhookData: AggregatorWebhookPayload = {
        reference: payload.reference,
        status: payload.status,
        amount: payload.amount,
        rawPayload: payload
      };

      await DepositOrchestrator.handleAggregatorWebhook(webhookData, signature, { rawBody });

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      console.error("[Webhook Error]", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
    },
  },
});
