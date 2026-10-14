import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Loader2, Info, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { useServerFn } from "@tanstack/react-start";
import { getWithdrawalContext, submitWithdrawal } from "@/actions/orchestrators/RetraitOrchestrator.server";
import { CodePays, PAYS, normaliserNumero } from "@/lib/mobile-money";

const schema = z.object({
  city: z.string().trim().min(1, "La ville est obligatoire").max(100),
  district: z.string().trim().min(1, "La rue ou le quartier est obligatoire").max(150),
  app_code: z.string().trim().min(1, "Choisissez une application"),
  id_1xbet: z.string().trim().regex(/^\d+$/, "L'ID joueur doit comporter uniquement des chiffres"),
  tx_id: z.string().trim().regex(/^[a-zA-Z0-9]{4,80}$/, "Le code de retrait doit comporter entre 4 et 80 caractères alphanumériques"),
  amount: z.coerce.number().int("Le montant doit être un entier").positive("Montant invalide"),
  recipient_name: z.string().trim().min(2, "Nom et prénom Mobile Money obligatoires").max(120),
  recipient_country: z.enum(["BJ", "TG"] as const),
  payment_method_id: z.string().uuid("Choisissez un moyen de paiement"),
  recipient_number: z.string().trim().min(6, "Numéro invalide"),
});

type FormValues = z.infer<typeof schema>;

export const Route = createFileRoute("/_authenticated/retrait")({
  component: RetraitPage,
});

function RetraitPage() {
  const { user, isVerified } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);

  // Clé d'idempotence unique générée une seule fois à l'ouverture du formulaire
  const [idempotencyKey] = useState<string>(() => crypto.randomUUID());

  const getContextFn = useServerFn(getWithdrawalContext);
  const submitWithdrawalFn = useServerFn(submitWithdrawal);

  const { data: context, isLoading: loadingContext } = useQuery({
    queryKey: ["withdrawal-context", user?.id],
    queryFn: async () => await getContextFn(),
    staleTime: 60_000,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      city: "",
      district: "",
      app_code: "1xbet",
      id_1xbet: "",
      tx_id: "",
      amount: 900,
      recipient_name: "",
      recipient_country: "BJ",
      payment_method_id: "",
      recipient_number: "",
    },
  });

  // Pré-remplissage des données dès réception du contexte serveur
  useEffect(() => {
    if (!context) return;

    if (context.profile.city) form.setValue("city", context.profile.city);
    if (context.profile.district) form.setValue("district", context.profile.district);
    if (context.profile.full_name) form.setValue("recipient_name", context.profile.full_name);
    if (context.lastId1xbet) form.setValue("id_1xbet", context.lastId1xbet);
    if (context.minAmount) form.setValue("amount", context.minAmount);

    // Détermination des pays actifs
    const activeCountries = Array.from(new Set(context.paymentMethods.map((m) => m.country as CodePays)));
    const defaultCountry = activeCountries.includes("BJ") ? "BJ" : (activeCountries[0] ?? "BJ");
    form.setValue("recipient_country", defaultCountry);

    // Premier moyen de paiement correspondant au pays
    const firstMethod = context.paymentMethods.find((m) => m.country === defaultCountry);
    if (firstMethod) form.setValue("payment_method_id", firstMethod.id);

    // Téléphone de l'utilisateur prérempli
    if (context.profile.phone) form.setValue("recipient_number", context.profile.phone);
  }, [context, form]);

  const selectedCountry = form.watch("recipient_country") as CodePays;
  const methodsForCountry = context?.paymentMethods.filter((m) => m.country === selectedCountry) ?? [];
  const activeCountries = Array.from(new Set(context?.paymentMethods.map((m) => m.country as CodePays) ?? ["BJ"]));

  // Validation intermédiaire avant affichage du modal de confirmation récapitulative
  const onValidateForm = (values: FormValues) => {
    // Vérification du montant minimum
    if (context?.minAmount && values.amount < context.minAmount) {
      form.setError("amount", {
        message: `Le montant minimum est de ${context.minAmount.toLocaleString("fr-FR")} FCFA`,
      });
      return;
    }

    // Vérification du plafond disponible
    if (context?.remainingDailyLimit !== undefined && values.amount > context.remainingDailyLimit) {
      form.setError("amount", {
        message: `Dépasse le plafond restant (${context.remainingDailyLimit.toLocaleString("fr-FR")} FCFA)`,
      });
      return;
    }

    // Vérification de la normalisation du numéro
    const norm = normaliserNumero(values.recipient_country, values.recipient_number);
    if (!norm) {
      form.setError("recipient_number", {
        message: `Numéro invalide pour ${PAYS[values.recipient_country]?.nom || values.recipient_country}`,
      });
      return;
    }

    setPendingValues(values);
    setShowConfirm(true);
  };

  // Envoi final après confirmation explicite
  const handleFinalSubmit = async () => {
    if (!pendingValues || !user) return;
    setSubmitting(true);

    const method = context?.paymentMethods.find((m) => m.id === pendingValues.payment_method_id);

    try {
      const res = await submitWithdrawalFn({
        data: {
          idempotency_key: idempotencyKey,
          city: pendingValues.city,
          district: pendingValues.district,
          app_code: pendingValues.app_code,
          id_1xbet: pendingValues.id_1xbet,
          tx_id: pendingValues.tx_id,
          amount: pendingValues.amount,
          recipient_name: pendingValues.recipient_name,
          recipient_country: pendingValues.recipient_country,
          payment_method_id: pendingValues.payment_method_id,
          recipient_number: pendingValues.recipient_number,
        },
      });

      setShowConfirm(false);

      // Notification WhatsApp vers l'agent sans le code de retrait (sécurité stricte)
      const adminLink = `${res.appUrl}/admin/demandes/${res.transaction.id}`;
      const norm = normaliserNumero(pendingValues.recipient_country, pendingValues.recipient_number);
      const cleanPhone = norm ? norm.e164 : pendingValues.recipient_number;

      const appName = context?.apps.find((a) => a.code === pendingValues.app_code)?.name || pendingValues.app_code.toUpperCase();

      const msg = `👋 Bonjour l'équipe 3AS, je souhaite finaliser mon retrait !

🎮 *Application* : ${appName}
👤 *ID Compte* : ${pendingValues.id_1xbet}
💰 *Montant* : ${pendingValues.amount.toLocaleString("fr-FR")} FCFA
📱 *Numéro réception* : ${cleanPhone} (${method?.name || "Mobile Money"})
👤 *Nom bénéficiaire* : ${pendingValues.recipient_name}
📍 *Adresse* : ${pendingValues.city}, ${pendingValues.district}

👉 *Lien de validation Admin* :
${adminLink}
`;
      const encodedMsg = encodeURIComponent(msg);
      const cleanWhatsapp = res.adminWhatsapp.replace(/\D/g, "");
      const waUrl = `https://wa.me/${cleanWhatsapp}?text=${encodedMsg}`;

      toast.success("Demande enregistrée ! Redirection vers WhatsApp...");
      window.location.href = waUrl;
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedMethod = context?.paymentMethods.find((m) => m.id === pendingValues?.payment_method_id);
  const selectedAppName = context?.apps.find((a) => a.code === pendingValues?.app_code)?.name || pendingValues?.app_code;

  return (
    <div className="px-4 py-5 max-w-md mx-auto space-y-4">
      <PageHeader title="Nouveau retrait" subtitle="Depuis votre compte de paris sportifs" />

      <Card className="bg-success/5 border-success/20">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-success uppercase tracking-wider">
            <Info className="h-3.5 w-3.5" />
            Comment ça marche
          </div>
          <p className="text-xs text-muted-foreground">
            1. Générez un code de retrait dans votre application (caisse 3AS).
            <br />
            2. Renseignez vos coordonnées de réception et le code.
            <br />
            3. Dès validation, notre agent encaisse le code et vous envoie les fonds sur votre Mobile Money.
          </p>
        </CardContent>
      </Card>

      {context && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-lg border bg-muted/40">
            <span className="text-muted-foreground">Minimum : </span>
            <strong className="font-semibold text-foreground">{context.minAmount.toLocaleString("fr-FR")} FCFA</strong>
          </div>
          <div className="p-2.5 rounded-lg border bg-muted/40">
            <span className="text-muted-foreground">Plafond restant : </span>
            <strong className="font-semibold text-foreground">{context.remainingDailyLimit.toLocaleString("fr-FR")} FCFA</strong>
          </div>
        </div>
      )}

      {isVerified === false && (
        <Card className="bg-destructive/5 border-destructive/20 mt-4">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-destructive uppercase tracking-wider">
              Compte non vérifié
            </div>
            <p className="text-xs text-muted-foreground">
              Vous devez effectuer au moins un rechargement réussi et vérifier votre numéro avant de pouvoir demander un retrait.
            </p>
          </CardContent>
        </Card>
      )}

      {loadingContext ? (
        <div className="py-12 flex justify-center items-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onValidateForm)} className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="p-4 space-y-4">
              {/* 1. Adresse : Ville et Quartier / Rue */}
              <div className="space-y-3 pb-2 border-b">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  1. Votre adresse (KYC)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Ville" error={form.formState.errors.city?.message}>
                    <Input placeholder="Ex: Cotonou" {...form.register("city")} />
                  </Field>
                  <Field label="Rue / Quartier" error={form.formState.errors.district?.message}>
                    <Input placeholder="Ex: Cadjèhoun" {...form.register("district")} />
                  </Field>
                </div>
              </div>

              {/* 2. Application */}
              <Field label="Application de paris" error={form.formState.errors.app_code?.message}>
                <Select
                  value={form.watch("app_code")}
                  onValueChange={(v) => form.setValue("app_code", v, { shouldValidate: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir l'application" /></SelectTrigger>
                  <SelectContent>
                    {context?.apps.map((a) => (
                      <SelectItem key={a.code} value={a.code}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* 3. User ID */}
              <Field label="ID Joueur (chiffres uniquement)" error={form.formState.errors.id_1xbet?.message}>
                <Input
                  inputMode="numeric"
                  placeholder="Ex : 123456789"
                  {...form.register("id_1xbet")}
                />
              </Field>

              {/* 4. Code de retrait */}
              <Field label="Code de retrait" error={form.formState.errors.tx_id?.message}>
                <Input
                  placeholder="Code alphanumérique reçu"
                  autoComplete="off"
                  {...form.register("tx_id")}
                />
              </Field>

              {/* 5. Montant */}
              <Field label="Montant à retirer (FCFA)" error={form.formState.errors.amount?.message}>
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="Ex: 5000"
                  {...form.register("amount")}
                />
              </Field>

              {/* 6. Nom et prénoms Mobile Money */}
              <Field label="Nom et prénoms sur le compte Mobile Money" error={form.formState.errors.recipient_name?.message}>
                <Input placeholder="Ex: Jean DUPONT" {...form.register("recipient_name")} />
              </Field>

              {/* 7. Pays (seuls les pays ayant un moyen actif) */}
              <Field label="Pays de réception">
                <Select
                  value={selectedCountry}
                  onValueChange={(v: CodePays) => {
                    form.setValue("recipient_country", v, { shouldValidate: true });
                    const firstInCountry = context?.paymentMethods.find((m) => m.country === v);
                    if (firstInCountry) form.setValue("payment_method_id", firstInCountry.id, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir le pays" /></SelectTrigger>
                  <SelectContent>
                    {activeCountries.map((c) => (
                      <SelectItem key={c} value={c}>
                        {PAYS[c]?.nom || c} (+{PAYS[c]?.indicatif})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {/* 8. Numéro de réception */}
              <Field
                label={`Numéro de réception (${PAYS[selectedCountry]?.nom})`}
                error={form.formState.errors.recipient_number?.message}
              >
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2 text-sm bg-muted rounded-md border text-muted-foreground font-mono font-medium">
                    +{PAYS[selectedCountry]?.indicatif}
                  </span>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder={`Ex : ${PAYS[selectedCountry]?.exemple || "01 23 45 67"}`}
                    {...form.register("recipient_number")}
                  />
                </div>
              </Field>

              {/* 9. Moyen de paiement filtré par pays */}
              <Field label="Moyen de paiement Mobile Money" error={form.formState.errors.payment_method_id?.message}>
                <Select
                  value={form.watch("payment_method_id")}
                  onValueChange={(v) => form.setValue("payment_method_id", v, { shouldValidate: true })}
                >
                  <SelectTrigger><SelectValue placeholder="Choisir un opérateur" /></SelectTrigger>
                  <SelectContent>
                    {methodsForCountry.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full h-12 bg-gradient-brand font-semibold cursor-pointer"
            disabled={submitting || isVerified === false}
          >
            Vérifier la demande <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </form>
      )}

      {/* 10. Étape de confirmation récapitulative : montant net = montant, Frais : aucun */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-success" /> Confirmation du retrait
            </DialogTitle>
            <DialogDescription>
              Vérifiez attentivement les informations ci-dessous avant transmission finale.
            </DialogDescription>
          </DialogHeader>

          {pendingValues && (
            <div className="space-y-3 py-2 text-sm">
              <div className="p-3 rounded-lg bg-muted/60 space-y-1.5 border">
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Application & Joueur</span>
                  <span className="font-semibold text-foreground font-mono">
                    {selectedAppName} — ID {pendingValues.id_1xbet}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Adresse KYC</span>
                  <span className="font-medium text-foreground">
                    {pendingValues.city}, {pendingValues.district}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Bénéficiaire</span>
                  <span className="font-medium text-foreground">{pendingValues.recipient_name}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Réception Mobile Money</span>
                  <span className="font-medium text-foreground font-mono">
                    {selectedMethod?.name} ({pendingValues.recipient_number})
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Montant demandé :</span>
                  <span className="font-semibold">{pendingValues.amount.toLocaleString("fr-FR")} FCFA</span>
                </div>
                <div className="flex justify-between items-center text-success font-medium">
                  <span>Frais :</span>
                  <span>aucun</span>
                </div>
                <div className="pt-2 border-t flex justify-between items-center text-base font-bold text-foreground">
                  <span>Montant net à recevoir :</span>
                  <span className="text-primary">{pendingValues.amount.toLocaleString("fr-FR")} FCFA</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Après confirmation, notre équipe vérifiera votre code de retrait auprès de la caisse pour transférer immédiatement vos fonds.
              </p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={submitting}>
              Modifier
            </Button>
            <Button
              onClick={handleFinalSubmit}
              disabled={submitting}
              className="bg-gradient-brand font-semibold"
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmer et envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
