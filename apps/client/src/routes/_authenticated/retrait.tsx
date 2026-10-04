import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { useServerFn } from "@tanstack/react-start";
import { submitWithdrawal } from "@/actions/orchestrators/RetraitOrchestrator.server";

const schema = z.object({
  id_1xbet: z.string().trim().min(3, "ID 1XBET invalide").max(30),
  amount: z.coerce.number().min(500, "Montant minimum 500 FCFA").max(10_000_000),
  payment_method_id: z.string().uuid("Choisissez un moyen de réception"),
  recipient_number: z.string().trim().min(8, "Numéro invalide").max(20),
  tx_id: z.string().trim().min(3, "Code retrait 1XBET requis").max(80),
});

export const Route = createFileRoute("/_authenticated/retrait")({
  component: RetraitPage,
});

function RetraitPage() {
  const { user, isVerified } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const { data: methods } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_methods").select("*").eq("active", true).order("name");
      return data ?? [];
    },
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { 
      id_1xbet: "", 
      amount: 0, 
      payment_method_id: "", 
      recipient_number: user?.user_metadata?.phone || user?.phone || "", 
      tx_id: "" 
    },
  });

  const submitWithdrawalFn = useServerFn(submitWithdrawal);

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (!user) return;
    setSubmitting(true);
    const method = methods?.find((m) => m.id === values.payment_method_id);
    
    try {
      const res = await submitWithdrawalFn({ 
        data: {
          id_1xbet: values.id_1xbet,
          amount: values.amount,
          payment_method_id: values.payment_method_id,
          payment_method_label: method?.name ?? "Inconnu",
          tx_id: values.tx_id,
          recipient_number: values.recipient_number,
        }
      });
      
      const adminLink = `${res.appUrl}/admin/demandes/${res.transaction.id}`;
      const msg = `👋 Bonjour l'équipe 3AS, je souhaite finaliser mon retrait !

👤 *ID 1XBET* : ${values.id_1xbet}
💰 *Montant* : ${values.amount} FCFA
🔐 *Code retrait* : ${values.tx_id}
📱 *Numéro réception* : ${values.recipient_number} (${method?.name})

👉 *Lien de validation Admin* : 
${adminLink}
`;
      const encodedMsg = encodeURIComponent(msg);
      // Nettoyage du numéro whatsapp (enlever les + et espaces)
      const cleanNumber = res.adminWhatsapp.replace(/\D/g, "");
      const waUrl = `https://wa.me/${cleanNumber}?text=${encodedMsg}`;
      
      toast.success("Redirection vers WhatsApp...");
      window.location.href = waUrl;
    } catch (error: any) {
      toast.error("Erreur", { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-5 max-w-md mx-auto space-y-4">
      <PageHeader title="Nouveau retrait" subtitle="Depuis votre compte 1XBET" />

      <Card className="bg-success/5 border-success/20">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-success uppercase tracking-wider">
            <Info className="h-3.5 w-3.5" />
            Comment ça marche
          </div>
          <p className="text-xs text-muted-foreground">
            Générez un code de retrait depuis votre compte 1XBET, puis transmettez-le ici avec votre numéro de réception. L'agent vous envoie l'argent après vérification.
          </p>
        </CardContent>
      </Card>

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

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <Card className="shadow-card">
          <CardContent className="p-4 space-y-4">
            <Field label="ID 1XBET" error={form.formState.errors.id_1xbet?.message}>
              <Input inputMode="numeric" placeholder="Ex : 123456789" {...form.register("id_1xbet")} />
            </Field>
            <Field label="Code de retrait 1XBET" error={form.formState.errors.tx_id?.message}>
              <Input placeholder="Code reçu de 1XBET" {...form.register("tx_id")} />
            </Field>
            <Field label="Montant (FCFA)" error={form.formState.errors.amount?.message}>
              <Input type="number" inputMode="numeric" placeholder="5000" {...form.register("amount")} />
            </Field>
            <Field label="Recevoir via" error={form.formState.errors.payment_method_id?.message}>
              <Select value={form.watch("payment_method_id")} onValueChange={(v) => form.setValue("payment_method_id", v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Choisir un moyen" /></SelectTrigger>
                <SelectContent>
                  {methods?.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Votre numéro de réception" error={form.formState.errors.recipient_number?.message}>
              <Input type="tel" inputMode="tel" placeholder="+229 01 23 45 67" {...form.register("recipient_number")} />
            </Field>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full h-12 bg-gradient-brand font-semibold" disabled={submitting || isVerified === false}>
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
