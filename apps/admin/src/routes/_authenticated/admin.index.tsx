import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle2, XCircle, Wallet, ListChecks, BarChart3, Users, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { data: stats } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: all } = await supabase.from("transactions").select("status, type, amount, created_at");
      const list = all ?? [];
      return {
        pending: list.filter((t) => t.status === "pending").length,
        validatedToday: list.filter((t) => t.status === "validated" && new Date(t.created_at) >= today).length,
        rejected: list.filter((t) => t.status === "rejected").length,
        totalToday: list
          .filter((t) => t.status === "validated" && t.type === "recharge" && new Date(t.created_at) >= today)
          .reduce((s, t) => s + Number(t.amount), 0),
      };
    },
  });

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Stat icon={Clock} label="En attente" value={stats?.pending ?? 0} color="text-amber-400" bg="bg-amber-500/10" />
        <Stat icon={CheckCircle2} label="Validées aujourd'hui" value={stats?.validatedToday ?? 0} color="text-lime-400" bg="bg-lime-500/10" />
        <Stat icon={XCircle} label="Rejetées" value={stats?.rejected ?? 0} color="text-red-400" bg="bg-red-500/10" />
        <Stat icon={Wallet} label="Reçu aujourd'hui" value={`${(stats?.totalToday ?? 0).toLocaleString("fr-FR")} F`} color="text-blue-400" bg="bg-blue-500/10" small />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/admin/demandes">
          <Card className="shadow-card hover:border-lime-400 transition-colors h-full bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex flex-col items-start gap-2">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <ListChecks className="h-5 w-5 text-blue-400" />
              </div>
              <div className="font-semibold text-white">Demandes Clients</div>
              <div className="text-xs text-slate-400">Valider dépôts & retraits</div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/clients">
          <Card className="shadow-card hover:border-lime-400 transition-colors h-full bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex flex-col items-start gap-2">
              <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-indigo-400" />
              </div>
              <div className="font-semibold text-white">Comptes Clients</div>
              <div className="text-xs text-slate-400">Contrôle & statuts KYC</div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/paiements">
          <Card className="shadow-card hover:border-lime-400 transition-colors h-full bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex flex-col items-start gap-2">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-amber-400" />
              </div>
              <div className="font-semibold text-white">Numéros Réception</div>
              <div className="text-xs text-slate-400">Gestion MTN/Moov/Celtiis</div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/stats">
          <Card className="shadow-card hover:border-lime-400 transition-colors h-full bg-slate-900 border-slate-800">
            <CardContent className="p-4 flex flex-col items-start gap-2">
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="font-semibold text-white">Statistiques</div>
              <div className="text-xs text-slate-400">Volumes & chiffres du jour</div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, color, bg, small }: {
  icon: typeof Clock; label: string; value: string | number; color: string; bg: string; small?: boolean;
}) {
  return (
    <Card className="shadow-card bg-slate-900 border-slate-800">
      <CardContent className="p-3 space-y-2">
        <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className={small ? "text-base font-bold text-white" : "text-2xl font-bold text-white"}>{value}</div>
        <div className="text-[11px] text-slate-400">{label}</div>
      </CardContent>
    </Card>
  );
}
