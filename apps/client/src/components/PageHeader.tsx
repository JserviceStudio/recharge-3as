import { ChevronLeft } from "lucide-react";
import { useRouter } from "@tanstack/react-router";

export function PageHeader({ title, subtitle, back = true }: { title: string; subtitle?: string; back?: boolean }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      {back && (
        <button onClick={() => router.history.back()} className="h-9 w-9 -ml-2 rounded-full flex items-center justify-center hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}
      <div>
        <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}
