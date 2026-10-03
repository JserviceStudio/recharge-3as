import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge, TypeBadge } from "@/components/StatusBadge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronRight, Inbox } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/demandes/")({
  component: DemandesList,
});

function DemandesList() {
  const [filter, setFilter] = useState<"pending" | "awaiting_payment" | "paid" | "crediting" | "validated" | "failed_credit" | "rejected" | "all">("pending");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-transactions", filter],
    queryFn: async () => {
      let q = supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (filter !== "all") q = q.eq("status", filter);
      const { data: transactions, error } = await q;
      if (error) throw error;

      const list = transactions ?? [];
      const userIds = Array.from(new Set(list.map((t) => t.user_id).filter(Boolean)));
      if (userIds.length === 0) return list;

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const profilesById = new Map((profiles ?? []).map((p) => [p.id, p]));
      return list.map((t) => ({ ...t, profiles: profilesById.get(t.user_id) ?? null }));
    },
    refetchInterval: 5000,
  });

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="pending">Attente</TabsTrigger>
          <TabsTrigger value="failed_credit" className="text-destructive">Échecs Crédit</TabsTrigger>
          <TabsTrigger value="validated">Validées</TabsTrigger>
          <TabsTrigger value="rejected">Rejetées</TabsTrigger>
          <TabsTrigger value="all">Toutes</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Chargement des demandes…
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive">
            Impossible de charger les demandes. Réessayez dans un instant.
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (!data || data.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="p-8 flex flex-col items-center gap-2 text-center">
            <Inbox className="h-10 w-10 text-muted-foreground" />
            <div className="text-sm">Aucune demande</div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {data?.map((t: any) => (
          <Link key={t.id} to="/admin/demandes/$id" params={{ id: t.id }}>
            <Card className="shadow-card hover:border-primary transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TypeBadge type={t.type} />
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="font-bold text-foreground">
                    {Number(t.amount).toLocaleString("fr-FR")} FCFA
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {t.profiles?.full_name ?? "—"} · {t.profiles?.phone ?? ""}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(t.created_at), { locale: fr, addSuffix: true })}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}