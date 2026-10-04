import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground font-bold shadow-card">
        3AS
        <img src="/images/verified-badge.png" alt="Verified" className="absolute -bottom-1 -right-1 w-4 h-4 object-contain drop-shadow-sm" />
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="text-base font-bold text-foreground">3AS Recharge</div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">1XBET</div>
        </div>
      )}
    </div>
  );
}
