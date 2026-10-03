import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Inbox } from "lucide-react";

export const Route = createFileRoute("/_authenticated/historique")({
  component: HistoriquePage,
});

function HistoriquePage() {
  const { user } = useAuth();
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="px-4 py-5 max-w-md mx-auto space-y-4">
      <PageHeader title="Historique" subtitle="Toutes vos demandes" back={false} />

      {isLoading && <p className="text-center text-sm text-muted-foreground py-10">Chargement…</p>}

      {!isLoading && (transactions?.length ?? 0) === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 flex flex-col items-center gap-2 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <div className="text-sm font-medium text-foreground">Aucune demande</div>
            <p className="text-xs text-muted-foreground">Vos recharges et retraits apparaîtront ici.</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {transactions?.map((t) => (
          <Card key={t.id} className="shadow-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TypeBadge type={t.type} />
                    <span className="text-xs text-muted-foreground">{t.payment_method_label}</span>
                  </div>
                  <div className="font-bold text-lg text-foreground">
                    {Number(t.amount).toLocaleString("fr-FR")} FCFA
                  </div>
                  <div className="text-xs text-muted-foreground">ID 1XBET : {t.id_1xbet}</div>
                  {t.tx_id && <div className="text-xs text-muted-foreground truncate">Réf : {t.tx_id}</div>}
                  {t.status === "rejected" && t.rejection_reason && (
                    <div className="text-xs text-destructive mt-1 bg-destructive/5 rounded p-2">
                      Motif : {t.rejection_reason}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground pt-1">
                    {formatDistanceToNow(new Date(t.created_at), { locale: fr, addSuffix: true })}
                  </div>
                </div>
                <StatusBadge status={t.status} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
