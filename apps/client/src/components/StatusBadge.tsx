import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";

export function StatusBadge({ status }: { status: "pending" | "awaiting_payment" | "paid" | "crediting" | "validated" | "failed_credit" | "rejected" }) {
  switch (status) {
    case "pending":
    case "awaiting_payment":
      return (
        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1">
          <Clock className="h-3 w-3" /> {status === "awaiting_payment" ? "Paiement attendu" : "En attente"}
        </Badge>
      );
    case "paid":
    case "crediting":
      return (
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Crédit 1XBET...
        </Badge>
      );
    case "validated":
      return (
        <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Validée
        </Badge>
      );
    case "failed_credit":
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1 animate-pulse">
          <AlertTriangle className="h-3 w-3" /> Échec crédit
        </Badge>
      );
    case "rejected":
    default:
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 gap-1">
          <XCircle className="h-3 w-3" /> Rejetée
        </Badge>
      );
  }
}

export function TypeBadge({ type }: { type: "recharge" | "withdrawal" }) {
  return (
    <Badge variant="secondary" className="text-[10px]">
      {type === "recharge" ? "Recharge" : "Retrait"}
    </Badge>
  );
}
