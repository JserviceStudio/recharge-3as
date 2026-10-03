import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapFirstAdmin } from "@/lib/admin.functions";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";

/**
 * Bouton de bootstrap admin. La promotion est gérée uniquement côté serveur
 * via la fonction `bootstrap_first_admin` qui n'agit que si aucun admin n'existe.
 * Aucune logique sensible côté client.
 */
export function PromoteAdminButton() {
  const { user, refreshRole, role } = useAuth();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const bootstrap = useServerFn(bootstrapFirstAdmin);

  if (!user || role === "admin" || done) return null;

  const promote = async () => {
    setLoading(true);
    try {
      const res = await bootstrap({});
      if (res.promoted) {
        toast.success("Vous êtes maintenant administrateur");
        await refreshRole();
      } else {
        toast.info("Un administrateur existe déjà");
        setDone(true);
      }
    } catch (e: any) {
      toast.error("Action refusée", { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Shield className="h-4 w-4" />
        Configuration initiale
      </div>
      <p className="text-xs text-muted-foreground">
        Si aucun administrateur n'a encore été créé, vous pouvez devenir le premier admin.
      </p>
      <Button onClick={promote} disabled={loading} size="sm" className="w-full">
        {loading && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
        Devenir administrateur
      </Button>
    </div>
  );
}
