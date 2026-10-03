import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DepositOrchestrator } from "@/actions/orchestrators/DepositOrchestrator.server";
import { AggregatorWebhookPayload } from "@/types/backend";

export const APIRoute = {
  POST: async ({ request }: { request: Request }) => {
    try {
      const payload = await request.json();
      const signature = request.headers.get("x-aggregator-signature") || "";
      
      const webhookData: AggregatorWebhookPayload = {
        reference: payload.reference,
        status: payload.status,
        amount: payload.amount,
        rawPayload: payload
      };

      await DepositOrchestrator.handleAggregatorWebhook(webhookData, signature);

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
};
