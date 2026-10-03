import { supabase } from "@/integrations/supabase/client";

export const APIRoute = {
  GET: async ({ request }: { request: Request }) => {
    try {
      const authHeader = request.headers.get("Authorization");
      // Fallback sur VITE_CRON_SECRET si on est dans un build Vite, sinon process.env
      const cronSecret = import.meta.env.VITE_CRON_SECRET || process.env.CRON_SECRET;
      
      if (!cronSecret) {
        return new Response(JSON.stringify({ error: "Configuration manquante (CRON_SECRET)" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      if (authHeader !== `Bearer ${cronSecret}`) {
        return new Response(JSON.stringify({ error: "Non autorisé" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      }

      // On cherche les transactions awaiting_payment de plus de 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60000).toISOString();
      
      const { data: expiredTxs, error: fetchErr } = await supabase
        .from("transactions")
        .select("id")
        .eq("status", "awaiting_payment")
        .lt("created_at", fifteenMinutesAgo);
        
      if (fetchErr) throw fetchErr;
      
      if (!expiredTxs || expiredTxs.length === 0) {
        return new Response(JSON.stringify({ message: "Aucune transaction à purger" }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      }
      
      const ids = expiredTxs.map(t => t.id);
      
      const { error: updateErr } = await supabase
        .from("transactions")
        .update({ status: "rejected", failure_reason: "Expiré (délai de paiement dépassé)" })
        .in("id", ids);
        
      if (updateErr) throw updateErr;

      return new Response(JSON.stringify({ message: `${ids.length} transactions purgées` }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
