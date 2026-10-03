import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Phone, MessageCircle, Clock, Copy } from "lucide-react";
import { toast } from "sonner";

const SUPPORT_PHONE = "+229 01 94 98 93 97";
const SUPPORT_WHATSAPP = "2290194989397";

export const Route = createFileRoute("/_authenticated/assistance")({
  component: AssistancePage,
});

function AssistancePage() {
  const copyPhone = () => {
    navigator.clipboard.writeText(SUPPORT_PHONE);
    toast.success("Numéro copié !");
  };

  const openWhatsApp = () => {
    window.open(`https://wa.me/${SUPPORT_WHATSAPP}`, "_blank");
  };

  return (
    <div className="px-4 py-5 max-w-md mx-auto space-y-4">
      <PageHeader title="Assistance" subtitle="Contactez-nous en cas de difficulté" back={false} />

      <Card className="bg-gradient-hero text-primary-foreground border-0 shadow-elevated">
        <CardContent className="p-5 space-y-2">
          <h2 className="text-lg font-bold">Besoin d'aide ?</h2>
          <p className="text-sm opacity-90">
            En cas de problème avec vos recharges, retraits ou votre compte, notre équipe est disponible pour vous assister.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <Card className="shadow-card border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">WhatsApp</div>
              <div className="text-xs text-muted-foreground">Réponse rapide garantie</div>
            </div>
            <Button size="sm" onClick={openWhatsApp}>
              Écrire
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <Phone className="h-5 w-5 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">Téléphone</div>
              <div className="text-xs text-muted-foreground truncate">{SUPPORT_PHONE}</div>
            </div>
            <Button size="sm" variant="outline" onClick={copyPhone}>
              <Copy className="h-3.5 w-3.5 mr-1" />
              Copier
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-warning" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground">Disponibilité</div>
              <div className="text-xs text-muted-foreground">Lun - Dim : 07h00 - 00h00</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
