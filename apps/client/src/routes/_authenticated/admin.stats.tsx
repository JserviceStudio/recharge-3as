import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/admin/stats")({
  component: StatsPage,
});

function StatsPage() {
  const { data } = useQuery({
    queryKey: ["admin-full-stats"],
    queryFn: async () => {
      const { data: all } = await supabase
        .from("transactions")
        .select("type, status, amount, payment_method_label, created_at")
        .eq("status", "validated");
      const list = all ?? [];
      const now = new Date();
      const startDay = new Date(now); startDay.setHours(0, 0, 0, 0);
      const startWeek = new Date(now); startWeek.setDate(now.getDate() - 7);
      const startMonth = new Date(now); startMonth.setDate(now.getDate() - 30);

      const periods = [
        { key: "day", label: "Aujourd'hui", from: startDay },
        { key: "week", label: "7 derniers jours", from: startWeek },
        { key: "month", label: "30 derniers jours", from: startMonth },
      ];

      const computed = periods.map((p) => {
        const sub = list.filter((t) => new Date(t.created_at) >= p.from);
        const recharges = sub.filter((t) => t.type === "recharge");
        const retraits = sub.filter((t) => t.type === "withdrawal");
        return {
          ...p,
          recharges: recharges.reduce((s, t) => s + Number(t.amount), 0),
          retraits: retraits.reduce((s, t) => s + Number(t.amount), 0),
          countR: recharges.length,
          countW: retraits.length,
        };
      });

      const byMethod = new Map<string, number>();
      list.filter(t => t.type === "recharge").forEach((t) => {
        byMethod.set(t.payment_method_label, (byMethod.get(t.payment_method_label) ?? 0) + Number(t.amount));
      });

      return { periods: computed, byMethod: Array.from(byMethod.entries()) };
    },
  });

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      {data?.periods.map((p) => (
        <Card key={p.key} className="shadow-card">
          <CardContent className="p-4 space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{p.label}</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-muted-foreground">Recharges ({p.countR})</div>
                <div className="text-lg font-bold text-success">+{p.recharges.toLocaleString("fr-FR")} F</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Retraits ({p.countW})</div>
                <div className="text-lg font-bold text-primary">-{p.retraits.toLocaleString("fr-FR")} F</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="shadow-card">
        <CardContent className="p-4 space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Par moyen de paiement (recharges validées)</div>
          {data?.byMethod.length === 0 && <p className="text-sm text-muted-foreground">Aucune donnée</p>}
          {data?.byMethod.map(([name, total]) => (
            <div key={name} className="flex items-center justify-between">
              <span className="text-sm">{name}</span>
              <span className="font-bold">{total.toLocaleString("fr-FR")} F</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
