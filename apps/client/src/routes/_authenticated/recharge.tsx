import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState } from "react";
import { Loader2, Upload, Info, Copy, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { initiateDepositFn } from "@/lib/deposit.functions";

const schema = z.object({
  id_1xbet: z.string().trim().min(3, "ID 1XBET invalide").max(30),
  amount: z.coerce.number().min(100, "Montant minimum 100 FCFA").max(10_000_000),
});

export const Route = createFileRoute("/_authenticated/recharge")({
  component: RechargePage,
});

function RechargePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // La sélection du réseau se fera directement sur la page FedaPay


  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      id_1xbet: "",
      amount: Number(localStorage.getItem("last_amount") ?? "100") || 100,
    },
  });

  // Pré-remplit l'ID 1XBET et le montant utilisés lors de la dernière recharge
  useEffect(() => {
    const savedId = localStorage.getItem("last_id_1xbet");
    if (savedId) form.setValue("id_1xbet", savedId);
    const savedAmount = localStorage.getItem("last_amount");
    if (savedAmount) form.setValue("amount", Number(savedAmount) || 100, { shouldValidate: true });
  }, []);



  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (!user) return;
    setSubmitting(true);

    try {
      const res = await initiateDepositFn({
        data: {
          userId: user.id,
          id1xbet: values.id_1xbet,
          amount: values.amount,
          paymentMethodId: "fedapay-checkout",
          paymentMethodLabel: "FedaPay",
          userPhone: user.user_metadata?.phone || user.phone || "00000000",
        }
      });

      localStorage.setItem("last_id_1xbet", values.id_1xbet);
      localStorage.setItem("last_amount", String(values.amount));

      if (res.checkoutUrl) {
        toast.info("Redirection vers la page de paiement...");
        window.location.href = res.checkoutUrl;
      } else {
        toast.success("Demande envoyée !", { description: "Votre recharge est en attente de validation." });
        navigate({ to: "/historique" });
      }
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-5 max-w-md mx-auto space-y-4">
      <PageHeader title="Nouvelle recharge" subtitle="Vers votre compte 1XBET" />

        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
              <Info className="h-3.5 w-3.5" />
              Paiement sécurisé
            </div>
            <p className="text-xs text-muted-foreground">
              Vous serez redirigé vers FedaPay pour choisir votre réseau (Mobile Money) et valider le paiement de {form.watch("amount") || 0} FCFA.
            </p>
          </CardContent>
        </Card>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card className="shadow-card">
          <CardContent className="p-4 space-y-4">
            <Field label="ID 1XBET du client" error={form.formState.errors.id_1xbet?.message}>
              <Input inputMode="numeric" placeholder="Ex : 123456789" {...form.register("id_1xbet")} />
            </Field>

            <Field label="Montant (FCFA) — minimum : 100 FCFA" error={form.formState.errors.amount?.message}>
              <Input type="number" inputMode="numeric" placeholder="1000" {...form.register("amount")} />
            </Field>



          </CardContent>
        </Card>

        <Button type="submit" className="w-full h-12 bg-gradient-brand font-semibold" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Envoyer la demande
        </Button>
      </form>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
