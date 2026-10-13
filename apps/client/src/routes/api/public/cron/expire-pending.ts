import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadServerEnv } from "@/server-env";

/**
 * Expire les dépôts abandonnés AVANT tout paiement : `awaiting_payment`, plus de 30 min, et
 * AUCUNE référence FedaPay (l'envoi à l'opérateur n'a jamais abouti).
 *
 * Un dépôt qui a une référence FedaPay n'est JAMAIS expiré ici, quel que soit son âge : le client
 * a peut-être payé (validation tardive, webhook perdu). C'est sync-fedapay qui relit son état réel
 * chez FedaPay et le crédite ou le rejette. Avant le 2026-10-13, cette tâche expirait à 15 min sans
 * rien vérifier : un paiement validé tard aurait été perdu.
 */
export const Route = createFileRoute("/api/public/cron/expire-pending")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          loadServerEnv();
          const cronSecret = process.env.CRON_SECRET;
          if (!cronSecret || request.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
            return new Response("Unauthorized", { status: 401 });
          }

          const limite = new Date(Date.now() - 30 * 60000).toISOString();
          const { data: abandonnes, error } = await supabaseAdmin
            .from("transactions")
            .select("id")
            .eq("status", "awaiting_payment")
            .is("provider_ref", null)
            .lt("created_at", limite)
            .limit(500);
          if (error) throw error;

          const ids = (abandonnes || []).map((t: { id: string }) => t.id);
          if (ids.length > 0) {
            const { error: updateErr } = await supabaseAdmin
              .from("transactions")
              .update({ status: "rejected", failure_reason: "Expiré : paiement jamais initié auprès de l'opérateur" })
              .in("id", ids)
              .eq("status", "awaiting_payment")
              .is("provider_ref", null);
            if (updateErr) throw updateErr;
          }

          return new Response(JSON.stringify({ success: true, expires: ids.length }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error: any) {
          console.error("[Cron Expire Error]", error);
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
