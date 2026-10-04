import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Phone, Lock, ShieldAlert, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail, useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

const loginSchema = z.object({
  phone: z.string().trim().min(8, "Numéro invalide").max(20),
  password: z.string().min(1, "Mot de passe requis").max(72),
});

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { user, loading, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Only process redirect if we have a resolved role (avoid instant logout during async fetch)
    if (!loading && user && role !== null) {
      if (role === "admin") {
        navigate({ to: "/admin", replace: true });
      } else {
        toast.error("Accès refusé", { description: "Vous n'êtes pas administrateur." });
        supabase.auth.signOut();
      }
    }
  }, [loading, user, role, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      
      {/* Background decorations for Admin (Serious/Security vibe) */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-900/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl translate-x-1/2 translate-y-1/2 pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative z-10">
        
        {/* Header Admin */}
        <div className="relative p-8 border-b border-slate-800 text-center flex flex-col items-center overflow-hidden">
          {/* Background Image */}
          <div className="absolute inset-0 z-0">
            <img src="/images/ucl-ball.png" alt="Header Background" className="w-full h-full object-cover opacity-50 mix-blend-luminosity" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/40 via-slate-950/80 to-slate-900" />
          </div>

          <div className="relative z-10 flex flex-col items-center w-full">
            <Logo compact className="mb-6 scale-125 origin-center drop-shadow-lg" />
            
            <div className="mx-auto w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center mb-3 border border-red-500/30 backdrop-blur-sm shadow-xl">
              <ShieldAlert className="text-red-400 h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase drop-shadow-lg">Portail Agent</h1>
            <p className="text-sm text-slate-300 mt-2 font-medium drop-shadow-md">
              Accès restreint au personnel autorisé.
            </p>
          </div>
        </div>

        {/* Login Form */}
        <div className="p-8">
          <LoginForm onSuccess={() => navigate({ to: "/admin" })} />
        </div>
      </div>
      
      <div className="mt-8 text-center text-xs text-slate-600 relative z-10">
        &copy; {new Date().getFullYear()} 3AS Infrastructure. Tous droits réservés.
      </div>
    </div>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
      toast.error("Accès refusé", { description: "Identifiants invalides." });
      return;
    }
    // Redirect logic handles role check
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="phone-login" className="text-slate-300 ml-1">Identifiant Agent (Numéro)</Label>
        <div className="relative">
          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            id="phone-login" type="tel" inputMode="tel" placeholder="+229..." 
            className="pl-11 h-12 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 rounded-xl focus-visible:ring-red-500" 
            {...form.register("phone")} 
          />
        </div>
        {form.formState.errors.phone && <p className="text-xs text-red-400 ml-1">{form.formState.errors.phone.message}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password-login" className="text-slate-300 ml-1">Mot de passe sécurisé</Label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            id="password-login" type={showPassword ? "text" : "password"} 
            className="pl-11 pr-12 h-12 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 rounded-xl focus-visible:ring-red-500" 
            placeholder="••••••••"
            {...form.register("password")} 
          />
          <button 
            type="button" 
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {form.formState.errors.password && <p className="text-xs text-red-400 ml-1">{form.formState.errors.password.message}</p>}
      </div>
      
      <div className="pt-6">
        <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white h-12 rounded-xl font-bold shadow-lg shadow-red-900/20" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          S'authentifier
        </Button>
      </div>
    </form>
  );
}
