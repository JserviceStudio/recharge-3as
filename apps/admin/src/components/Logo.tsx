import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 shadow-card overflow-hidden p-0.5">
        <img src="/3as-logo-official.png" alt="3AS" className="h-full w-full object-contain" />
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
