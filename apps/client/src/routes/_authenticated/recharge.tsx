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
import { PAYS, normaliserNumero, reseauRecharge, reseauxDuPays, type CodePays } from "@/lib/mobile-money";

const schema = z
  .object({
    id_1xbet: z.string().trim().regex(/^\d{3,30}$/, "ID 1XBET invalide (chiffres uniquement)"),
    amount: z.coerce.number().int("Montant entier uniquement").min(100, "Montant minimum 100 FCFA").max(10_000_000),
    country: z.enum(["BJ", "TG"]),
    network: z.string().min(2, "Veuillez choisir un réseau"),
    phone: z.string().min(8, "Numéro invalide"),
  })
  .superRefine((v, ctx) => {
    const reseau = reseauRecharge(v.network);
    if (!reseau || reseau.pays !== v.country) {
      ctx.addIssue({ code: "custom", path: ["network"], message: "Choisissez un réseau de ce pays" });
    }
    if (!normaliserNumero(v.country, v.phone)) {
      const p = PAYS[v.country];
      ctx.addIssue({ code: "custom", path: ["phone"], message: `Numéro ${p.nom} invalide (ex : ${p.exemple})` });
    }
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
      phone: user?.user_metadata?.phone || user?.phone || "",
      country: "BJ",
      network: "mtn_bj",
    },
  });
  const pays = form.watch("country") as CodePays;

  // Pré-remplit l'ID 1XBET et le montant utilisés lors de la dernière recharge
  useEffect(() => {
    const savedId = localStorage.getItem("last_id_1xbet");
    if (savedId) form.setValue("id_1xbet", savedId);
    const savedAmount = localStorage.getItem("last_amount");
    if (savedAmount) form.setValue("amount", Number(savedAmount) || 100, { shouldValidate: true });
    // Dernier réseau utilisé (ancien code « mtn » compris) : le pays suit le réseau.
    const savedNetwork = reseauRecharge(localStorage.getItem("last_network"));
    if (savedNetwork) {
      form.setValue("country", savedNetwork.pays);
      form.setValue("network", savedNetwork.code);
    }
  }, []);



  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (!user) return;
    setSubmitting(true);

    try {
      await initiateDepositFn({
        data: {
          id1xbet: values.id_1xbet,
          amount: values.amount,
          paymentMethodId: "fedapay-direct",
          paymentMethodLabel: "FedaPay Mobile Money",
          userPhone: normaliserNumero(values.country, values.phone)!.e164,
          network: values.network,
        }
      });

      localStorage.setItem("last_id_1xbet", values.id_1xbet);
      localStorage.setItem("last_amount", String(values.amount));
      localStorage.setItem("last_network", values.network);

      toast.success("Demande envoyée !", { description: "Veuillez valider le paiement (Code PIN) sur votre téléphone." });
      navigate({ to: "/historique" });
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
              Veuillez saisir votre numéro et réseau. Vous validerez directement le paiement sur votre téléphone.
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

            <Field label="Pays" error={form.formState.errors.country?.message}>
              <Select
                value={pays}
                onValueChange={(val) => {
                  const p = val as CodePays;
                  form.setValue("country", p);
                  // Changer de pays remet le premier réseau de ce pays : jamais « MTN » au Togo.
                  form.setValue("network", reseauxDuPays(p)[0].code, { shouldValidate: true });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un pays" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PAYS) as CodePays[]).map((code) => (
                    <SelectItem key={code} value={code}>{PAYS[code].nom} (+{PAYS[code].indicatif})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Réseau Mobile" error={form.formState.errors.network?.message}>
              <Select value={form.watch("network")} onValueChange={(val) => form.setValue("network", val, { shouldValidate: true })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un réseau" />
                </SelectTrigger>
                <SelectContent>
                  {reseauxDuPays(pays).map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Numéro de téléphone de paiement" error={form.formState.errors.phone?.message}>
              <Input type="tel" inputMode="tel" placeholder={`+${PAYS[pays].indicatif} ${PAYS[pays].exemple}`} {...form.register("phone")} />
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
