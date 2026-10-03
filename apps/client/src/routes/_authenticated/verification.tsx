import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { verifyPhoneWithTransaction } from "@/actions/orchestrators/VerificationOrchestrator.server";

// @ts-ignore
export const Route = createFileRoute("/_authenticated/verification")({
  component: VerificationPage,
});

function VerificationPage() {
  const { user, isVerified, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [smsId, setSmsId] = useState("");
  const [loading, setLoading] = useState(false);
  const verifyFn = useServerFn(verifyPhoneWithTransaction);

  // If they are already verified, send them to dashboard
  
  useEffect(() => {
    if (isVerified) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [isVerified, navigate]);

  if (isVerified) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsId.trim()) return;

    setLoading(true);
    try {
      await verifyFn({ data: { smsId: smsId.trim() } });
      await refreshProfile();
      toast.success("Félicitations ! Votre compte est validé.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error("Vérification échouée", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-md mx-auto space-y-6">
      <PageHeader title="Vérification requise" subtitle="Sécurisez votre compte" />

      <Card className="shadow-card border-warning/20 bg-warning/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-warning flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Confirmez votre numéro
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Pour valider que ce numéro vous appartient, effectuez votre <strong>premier rechargement</strong> (minimum 500 FCFA).
          </p>
          <p>
            Allez dans le menu de recharge. Une fois le paiement validé, vous recevrez un SMS avec un <strong>ID de transaction</strong> (ex: référence FedaPay ou Mobile Money). Collez-le ci-dessous.
          </p>
        </CardContent>
      </Card>

      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-2">
          <Label>ID de transaction reçu par SMS</Label>
          <Input 
            placeholder="Ex: ch_..." 
            value={smsId}
            onChange={(e) => setSmsId(e.target.value)}
          />
        </div>
        <Button 
          type="submit" 
          className="w-full bg-gradient-brand h-11 font-semibold" 
          disabled={loading || smsId.trim().length < 3}
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Valider mon compte
        </Button>
      </form>

      <div className="pt-4 flex justify-center">
        <Button variant="outline" onClick={() => navigate({ to: "/recharge" })}>
          Aller faire une recharge
        </Button>
      </div>
    </div>
  );
}
