import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2, LayoutDashboard, ListChecks, CreditCard, BarChart3, FileText, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Accueil", icon: LayoutDashboard, exact: true },
  { to: "/admin/demandes", label: "Demandes", icon: ListChecks },
  { to: "/admin/paiements", label: "Numéros", icon: CreditCard },
  { to: "/admin/stats", label: "Stats", icon: BarChart3 },
  { to: "/admin/logs", label: "Logs", icon: FileText },
];

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => {
    // Le check rôle est fait dans le composant pour éviter le SSR
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (role !== "admin") {
    throw redirect({ to: "/dashboard" });
  }

  return (
    <div className="bg-background min-h-[calc(100vh-3.5rem)]">
      <div className="bg-gradient-brand text-primary-foreground px-4 py-3 flex items-center gap-2">
        <Link to="/dashboard" className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/10">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <div className="text-xs uppercase tracking-wider opacity-80">Administration</div>
          <div className="font-bold">Espace Agent</div>
        </div>
      </div>

      <div className="overflow-x-auto border-b border-border bg-card">
        <div className="flex min-w-max">
          {tabs.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Link key={to} to={to as any} className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                active ? "border-primary text-primary" : "border-transparent text-muted-foreground"
              )}>
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </div>
      </div>

      <Outlet />
    </div>
  );
}
