import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getAdminSettings, updateAdminSettings } from "@/actions/orchestrators/SettingsOrchestrator.server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Settings2, MessageCircle, Link as LinkIcon, PhoneCall } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const qc = useQueryClient();
  const getSettingsFn = useServerFn(getAdminSettings);
  const updateSettingsFn = useServerFn(updateAdminSettings);
  const [whatsapp, setWhatsapp] = useState("");
  const [emergency, setEmergency] = useState("");
  const [appUrl, setAppUrl] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => await getSettingsFn(),
  });

  useEffect(() => {
    if (data) {
      setWhatsapp(data.whatsapp_number || "");
      setEmergency(data.emergency_number || "");
      setAppUrl(data.app_url || "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      await updateSettingsFn({ 
        data: { 
          whatsapp_number: whatsapp,
          emergency_number: emergency,
          app_url: appUrl
        } 
      });
    },
    onSuccess: () => {
      toast.success("Paramètres enregistrés !");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: any) => {
      toast.error("Erreur", { description: e.message });
    },
  });

  if (isLoading) {
    return <div className="p-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Settings2 className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-xl font-bold">Paramètres Système</h2>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-5 space-y-5">
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-primary" />
                URL de l'application
              </Label>
              <p className="text-xs text-muted-foreground">URL publique (ex: https://app.3as.com)</p>
            </div>
            <Input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://..." type="url" />
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-success" />
                Numéro WhatsApp Admin
              </Label>
              <p className="text-xs text-muted-foreground">Numéro pour la finalisation des retraits.</p>
            </div>
            <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+22901234567" type="tel" />
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <PhoneCall className="h-4 w-4 text-destructive" />
                Numéro d'urgence (Support)
              </Label>
              <p className="text-xs text-muted-foreground">Numéro affiché pour l'assistance client.</p>
            </div>
            <Input value={emergency} onChange={(e) => setEmergency(e.target.value)} placeholder="+22901234567" type="tel" />
          </div>

          <Button 
            className="w-full h-12 bg-primary text-primary-foreground font-semibold mt-4"
            onClick={() => save.mutate()}
            disabled={save.isPending || !whatsapp.trim() || !appUrl.trim()}
          >
            {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Enregistrer les modifications
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
