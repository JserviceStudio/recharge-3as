import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Clock, CheckCircle2, XCircle, Sparkles, Copy, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, isVerified } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id, status, type, amount")
        .eq("user_id", user!.id);
      const list = data ?? [];
      return {
        pending: list.filter((t) => t.status === "pending").length,
        validated: list.filter((t) => t.status === "validated").length,
        rejected: list.filter((t) => t.status === "rejected").length,
        totalRecharged: list
          .filter((t) => t.status === "validated" && t.type === "recharge")
          .reduce((s, t) => s + Number(t.amount), 0),
      };
    },
    enabled: !!user,
  });

  const copyPromo = () => {
    navigator.clipboard.writeText("FENOU229");
    toast.success("Code promo copié !");
  };

  return (
    <div className="px-4 py-5 space-y-5 max-w-md mx-auto">
      <div>
        <p className="text-sm text-muted-foreground">Bonjour,</p>
        <h1 className="text-2xl font-bold text-foreground">{profile?.full_name ?? "Client"} 👋</h1>
      </div>

      {isVerified === false && (
        <Card className="shadow-card border-warning/20 bg-warning/5">
          <CardContent className="p-4 flex flex-row items-center justify-between gap-4">
            <div className="space-y-1 flex-1">
              <div className="text-sm font-bold text-warning flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                Compte non vérifié
              </div>
              <p className="text-xs text-muted-foreground">Faites votre premier rechargement pour valider votre compte.</p>
            </div>
            <Button size="sm" variant="outline" className="border-warning text-warning hover:bg-warning/10 shrink-0" asChild>
              <Link to="/verification">Vérifier</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Banner Carousel */}
      <Card className="text-primary-foreground border-0 shadow-elevated overflow-hidden relative bg-[#0b1120] h-36">
        {/* Slide 1 : Promo Code */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentSlide === 0 ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity" style={{ backgroundImage: "url('/sports_blue_bg.png')" }} />
          <div className="absolute inset-0 bg-gradient-brand opacity-90" />
          <CardContent className="p-5 relative z-10 h-full flex flex-col justify-center">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider opacity-90 text-white">
                  <Sparkles className="h-3.5 w-3.5" />
                  Code Promo 1XBET
                </div>
                <div className="text-3xl font-black tracking-tight text-white drop-shadow-md">FENOU229</div>
                <p className="text-xs opacity-80 text-white">Utilisez ce code à l'inscription sur 1XBET</p>
              </div>
              <Button size="sm" variant="secondary" className="shrink-0 bg-white text-blue-900 hover:bg-slate-100 font-bold" onClick={copyPromo}>
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copier
              </Button>
            </div>
          </CardContent>
        </div>

        {/* Slide 2 : UCL Logo */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentSlide === 1 ? 'opacity-100' : 'opacity-0'}`}>
          <img src="/images/ucl-logo.png" alt="Champions League" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/80 to-transparent" />
          <CardContent className="p-5 relative z-10 h-full flex flex-col justify-center">
            <h3 className="text-2xl font-black text-white drop-shadow-lg leading-tight max-w-[200px]">Pariez sur la Ligue des Champions</h3>
          </CardContent>
        </div>

        {/* Slide 3 : UCL Ball */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${currentSlide === 2 ? 'opacity-100' : 'opacity-0'}`}>
          <img src="/images/ucl-ball.png" alt="UCL Ball" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0b1120]/90 via-[#0b1120]/50 to-transparent" />
          <CardContent className="p-5 relative z-10 h-full flex flex-col justify-center">
            <h3 className="text-xl font-bold text-white drop-shadow-lg mb-1">Vibrez au rythme du football</h3>
            <p className="text-xs text-slate-300">Rechargez et retirez instantanément</p>
          </CardContent>
        </div>

        {/* Pagination Dots */}
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 z-20">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className={`h-1.5 rounded-full transition-all ${currentSlide === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/40'}`} />
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/recharge">
          <Card className="shadow-card border-border hover:border-primary transition-colors h-full">
            <CardContent className="p-4 flex flex-col items-start gap-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <ArrowDownToLine className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Recharger</div>
                <div className="text-xs text-muted-foreground">Vers 1XBET</div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/retrait">
          <Card className="shadow-card border-border hover:border-primary transition-colors h-full">
            <CardContent className="p-4 flex flex-col items-start gap-2">
              <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
                <ArrowUpFromLine className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Retirer</div>
                <div className="text-xs text-muted-foreground">Depuis 1XBET</div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Stats */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Mes demandes</h2>
        <div className="grid grid-cols-3 gap-2">
          <StatCard icon={Clock} label="En attente" value={stats?.pending ?? 0} color="text-warning" bg="bg-warning/10" />
          <StatCard icon={CheckCircle2} label="Validées" value={stats?.validated ?? 0} color="text-success" bg="bg-success/10" />
          <StatCard icon={XCircle} label="Rejetées" value={stats?.rejected ?? 0} color="text-destructive" bg="bg-destructive/10" />
        </div>
      </div>

    </div>
  );
}

function StatCard({
  icon: Icon, label, value, color, bg,
}: { icon: typeof Clock; label: string; value: number; color: string; bg: string }) {
  return (
    <Card className="shadow-card">
      <CardContent className="p-3 flex flex-col items-center gap-1">
        <div className={`h-8 w-8 rounded-lg ${bg} flex items-center justify-center`}>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div className="text-lg font-bold text-foreground">{value}</div>
        <div className="text-[10px] text-muted-foreground text-center leading-tight">{label}</div>
      </CardContent>
    </Card>
  );
}
