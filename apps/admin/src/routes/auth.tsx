import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Phone, Lock, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail, normalizePhone, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Nom trop court").max(80),
  phone: z.string().trim().min(8, "Numéro invalide").max(20),
  password: z.string().min(6, "6 caractères minimum").max(72),
});
const loginSchema = z.object({
  phone: z.string().trim().min(8, "Numéro invalide").max(20),
  password: z.string().min(1, "Mot de passe requis").max(72),
});

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/admin", replace: true });
    }
  }, [loading, user, navigate]);


  return (
    <div className="min-h-screen bg-gradient-hero text-primary-foreground flex flex-col">
      <div className="px-6 pt-12 pb-8 text-center pt-safe">
        <div className="inline-flex flex-col items-center gap-3">
          <Logo compact />
          <h1 className="text-2xl font-bold mt-2">3AS Recharge 1XBET</h1>
          <p className="text-sm text-primary-foreground/80 max-w-xs">
            Recharges et retraits rapides directement vers votre compte 1XBET.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-xs font-semibold ring-1 ring-white/20">
            <span className="opacity-80">Code Promo :</span>
            <span className="text-warning">FENOU229</span>
          </div>
        </div>
      </div>

      <div className="flex-1 rounded-t-3xl bg-background text-foreground px-6 py-8 shadow-elevated">
        <Tabs defaultValue="login" className="max-w-md mx-auto">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login">Connexion</TabsTrigger>
            <TabsTrigger value="signup">Inscription</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <LoginForm onSuccess={() => navigate({ to: "/admin" })} />
          </TabsContent>
          <TabsContent value="signup">
            <SignupForm onSuccess={() => navigate({ to: "/admin" })} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "" },
  });

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setLoading(true);
    const email = phoneToEmail(values.phone);
    const { error } = await supabase.auth.signInWithPassword({ email, password: values.password });
    setLoading(false);
    if (error) {
      toast.error("Identifiants incorrects", { description: "Vérifiez votre numéro et votre mot de passe." });
      return;
    }
    toast.success("Connecté");
    onSuccess();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone-login">Numéro de téléphone</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="phone-login" type="tel" inputMode="tel" placeholder="+229 01 23 45 67" className="pl-9" {...form.register("phone")} />
        </div>
        {form.formState.errors.phone && <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-login">Mot de passe</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="password-login" type="password" className="pl-9" {...form.register("password")} />
        </div>
        {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground h-11 font-semibold" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Se connecter
      </Button>
    </form>
  );
}

function SignupForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { full_name: "", phone: "", password: "" },
  });

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    setLoading(true);
    const phone = normalizePhone(values.phone);
    const email = phoneToEmail(phone);
    const { error } = await supabase.auth.signUp({
      email,
      password: values.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: values.full_name, phone },
      },
    });
    setLoading(false);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("registered") || msg.includes("exists")) {
        toast.error("Compte existant", { description: "Ce numéro est déjà inscrit. Connectez-vous." });
      } else if (msg.includes("password")) {
        toast.error("Mot de passe trop faible", { description: error.message });
      } else {
        toast.error("Inscription impossible", { description: error.message });
      }
      return;
    }
    toast.success("Compte créé !");
    onSuccess();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name-signup">Nom complet</Label>
        <div className="relative">
          <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="name-signup" className="pl-9" placeholder="Votre nom" {...form.register("full_name")} />
        </div>
        {form.formState.errors.full_name && <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone-signup">Numéro de téléphone</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="phone-signup" type="tel" inputMode="tel" placeholder="+229 01 23 45 67" className="pl-9" {...form.register("phone")} />
        </div>
        {form.formState.errors.phone && <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-signup">Mot de passe</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="password-signup" type="password" className="pl-9" placeholder="6 caractères minimum" {...form.register("password")} />
        </div>
        {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
      </div>
      <Button type="submit" className="w-full bg-gradient-brand text-primary-foreground h-11 font-semibold" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Créer mon compte
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        En vous inscrivant, vous acceptez nos conditions d'utilisation.
      </p>
    </form>
  );
}
