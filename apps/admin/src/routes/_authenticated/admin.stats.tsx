import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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

      // Compute daily chart data for the last 30 days
      const chartDataMap = new Map<string, { date: string; recharges: number; retraits: number }>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        chartDataMap.set(dateStr, { date: dateStr, recharges: 0, retraits: 0 });
      }

      list.filter(t => new Date(t.created_at) >= startMonth).forEach(t => {
        const dStr = new Date(t.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        if (chartDataMap.has(dStr)) {
          const entry = chartDataMap.get(dStr)!;
          if (t.type === "recharge") entry.recharges += Number(t.amount);
          if (t.type === "withdrawal") entry.retraits += Number(t.amount);
        }
      });

      return { 
        periods: computed, 
        byMethod: Array.from(byMethod.entries()),
        chartData: Array.from(chartDataMap.values())
      };
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

      {data && (
        <Card className="shadow-card mt-8">
          <CardContent className="p-4 space-y-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Évolution des volumes (30 derniers jours)</div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRecharge" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRetrait" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                  <Tooltip 
                    formatter={(value: number) => [`${value.toLocaleString()} FCFA`, undefined]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="recharges" stroke="#10b981" fillOpacity={1} fill="url(#colorRecharge)" name="Recharges" />
                  <Area type="monotone" dataKey="retraits" stroke="#f43f5e" fillOpacity={1} fill="url(#colorRetrait)" name="Retraits" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

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
