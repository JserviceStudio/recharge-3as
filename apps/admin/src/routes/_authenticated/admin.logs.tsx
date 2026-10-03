import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  component: LogsPage,
});

function LogsPage() {
  const [tab, setTab] = useState<"admin" | "api">("api");

  const { data: adminLogs } = useQuery({
    queryKey: ["admin-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_logs").select("*").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
    enabled: tab === "admin",
  });

  const { data: apiLogs } = useQuery({
    queryKey: ["api-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("api_logs").select("*").order("created_at", { ascending: false }).limit(200);
      return data ?? [];
    },
    enabled: tab === "api",
  });

  const labels: Record<string, string> = {
    validate_transaction: "Validation",
    reject_transaction: "Rejet",
    retry_credit: "Relance 1XBET",
    force_manual_credit: "Validation Manuelle Forcée"
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div className="flex gap-2">
        <Button variant={tab === "api" ? "default" : "outline"} className="flex-1" onClick={() => setTab("api")}>API / Webhooks</Button>
        <Button variant={tab === "admin" ? "default" : "outline"} className="flex-1" onClick={() => setTab("admin")}>Actions Agent</Button>
      </div>

      {tab === "admin" && (
        <div className="space-y-2">
          {(!adminLogs || adminLogs.length === 0) && <p className="text-center text-sm text-muted-foreground py-10">Aucun log agent</p>}
          {adminLogs?.map((l) => (
            <Card key={l.id} className="shadow-card">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{labels[l.action] ?? l.action}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(l.created_at), { locale: fr, addSuffix: true })}
                  </span>
                </div>
                {l.details && (
                  <div className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded">
                    {JSON.stringify(l.details)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {tab === "api" && (
        <div className="space-y-2">
          {(!apiLogs || apiLogs.length === 0) && <p className="text-center text-sm text-muted-foreground py-10">Aucun log API</p>}
          {apiLogs?.map((l: any) => (
            <Card key={l.id} className="shadow-card">
              <CardContent className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${l.http_status >= 400 ? 'text-destructive' : 'text-success'}`}>
                    [{l.http_status}] {l.provider.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(l.created_at), { locale: fr, addSuffix: true })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">{l.endpoint}</div>
                {l.response_payload && (
                  <div className="text-[10px] text-muted-foreground font-mono bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(l.response_payload)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
