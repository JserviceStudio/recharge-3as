import { Link, useLocation } from "@tanstack/react-router";
import { Home, ArrowDownToLine, ArrowUpFromLine, History, Headphones, Bell, LogOut, Shield } from "lucide-react";
import { type ReactNode } from "react";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./NotificationBell";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", label: "Accueil", icon: Home },
  { to: "/admin/demandes", label: "Demandes", icon: ArrowDownToLine },
  { to: "/admin/paiements", label: "Paiements", icon: ArrowUpFromLine },
  { to: "/admin/stats", label: "Stats", icon: History },
  { to: "/admin/logs", label: "Logs", icon: Headphones },
] as const;

export function MobileLayout({ children }: { children: ReactNode }) {
  const { signOut, role } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 bg-gradient-hero text-primary-foreground pt-safe shadow-elevated">
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <Logo compact />
          <div className="flex items-center gap-1">
            {/* Cache admin button inside admin app */}
            <NotificationBell />
            <Button variant="ghost" size="icon" className="text-primary-foreground hover:bg-white/10" onClick={() => signOut()}>
              <LogOut className="h-5 w-5" />
            </Button>
            <div className="ml-1 h-11 w-11 rounded-full bg-white shadow-elevated ring-2 ring-white/40 overflow-hidden flex items-center justify-center p-1">
              <img src="/logo.svg" alt="3AS Recharge" className="h-full w-full object-contain" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24">
        {children}
        <div className="mt-6 px-4">
          <div className="w-full overflow-hidden rounded-2xl bg-black shadow-elevated flex items-center justify-center p-4 h-[2.5cm] relative">
            <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: "url('/sports_blue_bg.png')" }} />
            <img src="/logo.svg" alt="3AS Recharge" className="h-full object-contain max-w-full relative z-10 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" />
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border pb-safe shadow-elevated">
        <div className="grid grid-cols-5 gap-1 px-2 pt-2">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to || (to !== "/admin" && location.pathname.startsWith(to));
            return (
              <Link key={to} to={to as any} className="flex flex-col items-center gap-1 py-2 rounded-lg transition-colors">
                <Icon className={cn("h-5 w-5 transition-colors", active ? "text-primary" : "text-muted-foreground")} />
                <span className={cn("text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
