import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Loader2, LayoutDashboard, ListChecks, CreditCard, BarChart3, FileText, ChevronLeft, Settings, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs: { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }[] = [
  { to: "/admin", label: "Accueil", icon: LayoutDashboard, exact: true },
  { to: "/admin/demandes", label: "Demandes", icon: ListChecks },
  { to: "/admin/clients", label: "Clients", icon: Users },
  { to: "/admin/paiements", label: "Numéros", icon: CreditCard },
  { to: "/admin/stats", label: "Stats", icon: BarChart3 },
  { to: "/admin/logs", label: "Logs", icon: FileText },
  { to: "/admin/settings", label: "Paramètres", icon: Settings },
];

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: () => {
    // Le check rôle est fait dans le composant pour éviter le SSR
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { role, loading, signOut } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
      </div>
    );
  }

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans">
      {/* Top Bar Agent Espace Dédié */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/30">
            🛡️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-wide text-white uppercase">3AS Recharge</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-lime-500/20 text-lime-400 border border-lime-500/30">
                ESPACE AGENT CONTRÔLE
              </span>
            </div>
            <p className="text-xs text-slate-400">Panneau de supervision & contrôle des opérations clients</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Bouton pour basculer vers l'espace client */}
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Voir Espace Client</span>
          </Link>
          <button
            onClick={() => signOut()}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-colors border border-red-500/20"
            title="Déconnexion Agent"
          >
            Déconnexion
          </button>
        </div>
      </header>

      {/* Navigation des modules Agent */}
      <nav className="bg-slate-900/80 backdrop-blur border-b border-slate-800 px-4 overflow-x-auto">
        <div className="flex min-w-max gap-1">
          {tabs.map(({ to, label, icon: Icon, exact }) => {
            const active = exact ? location.pathname === to : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to as any}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-xs font-bold transition-all border-b-2 whitespace-nowrap",
                  active
                    ? "border-lime-400 text-lime-400 bg-lime-400/5"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-lime-400" : "text-slate-400")} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Contenu principal de l'agent */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
