import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  // Marquer comme lues à l'ouverture après 2s
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => markAllRead.mutate(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return (
    <div className="px-4 py-5 max-w-md mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <PageHeader title="Notifications" back={false} />
        {data && data.some((n) => !n.read) && (
          <Button size="sm" variant="ghost" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="h-4 w-4 mr-1" /> Tout lire
          </Button>
        )}
      </div>

      {(!data || data.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="p-8 flex flex-col items-center gap-2 text-center">
            <Bell className="h-10 w-10 text-muted-foreground" />
            <div className="text-sm font-medium">Aucune notification</div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {data?.map((n) => (
          <Card key={n.id} className={n.read ? "" : "border-primary/40 bg-primary/5"}>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-foreground text-sm">{n.title}</div>
                {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
              </div>
              <p className="text-sm text-muted-foreground">{n.message}</p>
              <p className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(n.created_at), { locale: fr, addSuffix: true })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
