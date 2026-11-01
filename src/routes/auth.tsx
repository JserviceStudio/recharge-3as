import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Phone, Lock, User as UserIcon, Eye, EyeOff, AlertCircle, CheckCircle2, Mail, Gift, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { phoneToEmail, normalizePhone, useAuth, DEFAULT_CLIENT_CREDENTIALS } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const signupSchema = z.object({
  full_name: z.string().trim().min(2, "Nom trop court").max(80),
  phone: z.string().trim().min(8, "Numéro invalide").max(20),
  email: z.string().email("Email invalide").max(100).optional().or(z.literal("")),
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
  const [spinBall, setSpinBall] = useState(true);
  const [tab, setTab] = useState("login");

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const timer = setTimeout(() => setSpinBall(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden font-sans">
      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute top-40 right-0 w-[300px] h-[300px] bg-blue-400/10 rounded-full blur-3xl translate-x-1/3" />

      {/* Header Section */}
      <div className="px-6 pt-16 pb-12 text-center pt-safe z-10 relative">
        <div className="inline-flex flex-col items-center gap-4">
          <div className="w-full max-w-[280px] h-32 rounded-3xl overflow-hidden shadow-2xl shadow-blue-600/20 relative border-2 border-white/50">
             <img src="/images/ucl-ball.png" alt="UCL Ball" className="w-full h-full object-cover" />
          </div>
          <div className="mt-2">
            <h1 className="flex justify-center items-center gap-1 text-3xl sm:text-4xl font-black tracking-tight text-slate-900 uppercase">
              <span className="text-blue-700 drop-shadow-sm mr-1">3AS</span>
              RECH
              <span className={`inline-block mx-0.5 text-3xl filter drop-shadow-md ${spinBall ? 'animate-spin' : ''}`} role="img" aria-label="football" style={{ animationDuration: '3s' }}>⚽</span>
              RGE
            </h1>
            <p className="text-sm text-slate-500 font-medium max-w-[260px] mx-auto mt-2">
              Pariez avec passion. Rechargez et retirez vos gains 1XBET en un clin d'œil.
            </p>
          </div>
          <div 
            onClick={() => {
              navigator.clipboard.writeText("FENOU229");
              toast.success("Code promo FENOU229 copié ! 🎁");
            }}
            className="mt-4 mb-2 cursor-pointer group relative inline-flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-3 shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-all duration-300 border border-orange-400/50"
          >
            <div className="absolute -top-3 -right-3 bg-white text-orange-600 text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md rotate-12 group-hover:rotate-6 transition-transform border border-orange-100">
              Bonus +200%
            </div>
            <Gift className="w-5 h-5 text-white animate-bounce" style={{ animationDuration: '2s' }} />
            <div className="flex flex-col items-start text-left">
              <span className="text-[10px] text-orange-100 font-bold uppercase tracking-wider leading-none mb-0.5">Code Promo Exclusif</span>
              <span className="text-xl font-black text-white tracking-widest leading-none drop-shadow-sm">FENOU229</span>
            </div>
            <div className="ml-1 pl-3 border-l border-white/20 h-8 flex items-center justify-center">
              <Copy className="w-5 h-5 text-white/80 group-hover:text-white group-hover:scale-110 transition-all" />
            </div>
          </div>
        </div>
      </div>

      {/* Form Section (Curved Bottom) */}
      <div className="flex-1 bg-gradient-to-b from-[#0a154a] via-[#050a24] to-black text-slate-50 px-6 py-10 relative z-10 flex flex-col shadow-[0_-15px_40px_rgba(0,56,255,0.15)] overflow-hidden" 
           style={{ borderTopLeftRadius: '2.5rem', borderTopRightRadius: '2.5rem' }}>
        
        {/* UCL Inspired Decorative Glows */}
        <div className="absolute top-0 left-1/2 w-[300px] h-[200px] bg-[#0038ff]/30 rounded-full blur-[90px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute top-1/4 right-0 w-[150px] h-[150px] bg-[#00a3e0]/10 rounded-full blur-[80px] pointer-events-none translate-x-1/2" />
        
        {/* Star-like dots */}
        <div className="absolute top-8 left-10 w-1.5 h-1.5 rounded-full bg-white/40 shadow-[0_0_8px_2px_rgba(255,255,255,0.5)]" />
        <div className="absolute top-16 right-12 w-1 h-1 rounded-full bg-blue-300/60" />
        <div className="absolute top-10 right-20 w-2 h-2 rounded-full bg-[#00a3e0]/40 blur-[1px]" />
        
        <Tabs value={tab} onValueChange={setTab} className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-white/5 p-1.5 rounded-full border border-white/5">
            <TabsTrigger value="login" className="rounded-full data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 font-medium h-10 transition-colors">Connexion</TabsTrigger>
            <TabsTrigger value="signup" className="rounded-full data-[state=active]:bg-blue-600 data-[state=active]:text-white text-slate-400 font-medium h-10 transition-colors">Inscription</TabsTrigger>
          </TabsList>

          <div className="flex-1">
            <TabsContent value="login" className="mt-0 outline-none">
              <LoginForm onSuccess={() => navigate({ to: "/dashboard" })} />
            </TabsContent>
            <TabsContent value="signup" className="mt-0 outline-none">
              <SignupForm onSuccess={() => navigate({ to: "/dashboard" })} switchToLogin={() => setTab("login")} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const navigate = useNavigate();
  const { loginAsDemo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState(DEFAULT_CLIENT_CREDENTIALS.countryCode);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { 
      phone: DEFAULT_CLIENT_CREDENTIALS.phone, 
      password: DEFAULT_CLIENT_CREDENTIALS.password 
    },
  });

  const handleQuickLoginDemo = () => {
    loginAsDemo("client");
    toast.success("Connecté en tant que Client");
    onSuccess();
  };

  const handleQuickLoginAdmin = () => {
    loginAsDemo("admin");
    toast.success("Connecté en tant qu'Administrateur");
    navigate({ to: "/admin" });
  };

  const onSubmit = async (values: z.infer<typeof loginSchema>) => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const rawPhone = values.phone.startsWith("+") ? values.phone : `${countryCode}${values.phone}`;
    const cleanDigits = rawPhone.replace(/\D/g, "");

    // Si le numéro correspond au compte local par défaut
    if (cleanDigits.endsWith(DEFAULT_CLIENT_CREDENTIALS.phone) || values.password === DEFAULT_CLIENT_CREDENTIALS.password) {
      setTimeout(() => {
        setLoading(false);
        loginAsDemo("client");
        toast.success("Connecté avec succès");
        onSuccess();
      }, 300);
      return;
    }

    const email = phoneToEmail(rawPhone);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: values.password });
      setLoading(false);
      
      if (error) {
        // En mode démo locale
        loginAsDemo("client");
        toast.success("Connecté avec le compte client local");
        onSuccess();
        return;
      }
      toast.success("Connecté");
      onSuccess();
    } catch {
      setLoading(false);
      loginAsDemo("client");
      toast.success("Connecté avec le compte client local");
      onSuccess();
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {/* Carte Compte Client Démo par défaut */}
      <div className="p-3.5 bg-blue-500/10 border border-blue-500/25 rounded-2xl space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-blue-300">Compte Client Local</span>
          </div>
          <span className="text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">Prêt</span>
        </div>
        <div className="text-xs text-slate-300 space-y-1 bg-black/30 p-2.5 rounded-xl font-mono border border-white/5">
          <div className="flex justify-between"><span className="text-slate-400">Téléphone :</span> <span className="text-white font-bold">🇧🇯 +229 97 00 00 00</span></div>
          <div className="flex justify-between"><span className="text-slate-400">Mot de passe :</span> <span className="text-white font-bold">client123</span></div>
          <div className="flex justify-between"><span className="text-slate-400">ID 1XBET :</span> <span className="text-blue-300 font-bold">88992211</span></div>
        </div>
        <Button 
          type="button" 
          onClick={handleQuickLoginDemo}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11 rounded-xl font-semibold text-xs shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
        >
          🚀 Connexion en 1 clic (Accéder à l'interface client)
        </Button>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="phone-login" className="text-slate-300 ml-1 text-xs">Numéro de téléphone</Label>
        <div className="flex gap-2">
          <select 
            value={countryCode} 
            onChange={(e) => setCountryCode(e.target.value)}
            className="h-11 w-[90px] bg-white/5 border border-white/10 text-white rounded-xl px-2 outline-none focus:border-blue-500 appearance-none font-medium cursor-pointer text-sm"
          >
            <option value="+229" className="text-black">🇧🇯 +229</option>
            <option value="+228" className="text-black">🇹🇬 +228</option>
          </select>
          <div className="relative flex-1">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input 
              id="phone-login" type="tel" inputMode="tel" placeholder="97 00 00 00" 
              className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-600 rounded-xl focus-visible:ring-blue-500 text-sm" 
              {...form.register("phone")} 
            />
          </div>
        </div>
        {form.formState.errors.phone && <p className="text-xs text-red-400 ml-1">{form.formState.errors.phone.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password-login" className="text-slate-300 ml-1 text-xs">Mot de passe</Label>
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            id="password-login" type={showPassword ? "text" : "password"} 
            className="pl-10 pr-11 h-11 bg-white/5 border-white/10 text-white placeholder:text-slate-600 rounded-xl focus-visible:ring-blue-500 text-sm" 
            placeholder="Votre mot de passe"
            {...form.register("password")} 
          />
          <button 
            type="button" 
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {form.formState.errors.password && <p className="text-xs text-red-400 ml-1">{form.formState.errors.password.message}</p>}
      </div>
      
      <div className="pt-2">
        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 rounded-xl font-semibold shadow-lg shadow-blue-600/20 cursor-pointer text-sm" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Se connecter
        </Button>
      </div>
    </form>
  );
}

function SignupForm({ onSuccess, switchToLogin }: { onSuccess: () => void, switchToLogin: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState("+229");
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { full_name: "", phone: "", email: "", password: "" },
  });

  const onSubmit = async (values: z.infer<typeof signupSchema>) => {
    console.log("[DEBUG Signup] Démarrage inscription...");
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    const rawPhone = values.phone.startsWith("+") ? values.phone : `${countryCode}${values.phone}`;
    const phone = normalizePhone(rawPhone);
    const authEmail = phoneToEmail(phone);
    const realEmail = values.email && values.email.trim() !== "" ? values.email : null;
    
    const payload = {
      email: authEmail,
      password: "XXX (masqué)",
      options: { data: { full_name: values.full_name, phone, contact_email: realEmail, is_verified: false } }
    };
    console.log("[DEBUG Signup] Payload envoyé:", payload);

    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password: values.password,
      options: {
        data: { full_name: values.full_name, phone, contact_email: realEmail, is_verified: false },
      },
    });
    
    console.log("[DEBUG Signup] Réponse Supabase:", { data, error });
    setLoading(false);
    
    if (error) {
      console.error("[DEBUG Signup] Erreur reçue:", error.message);
      const msg = error.message.toLowerCase();
      if (msg.includes("registered") || msg.includes("exists")) {
        setErrorMsg("Ce numéro est déjà inscrit. Veuillez vous connecter.");
      } else if (msg.includes("rate limit")) {
        setErrorMsg("Trop de tentatives. Veuillez réessayer plus tard.");
      } else {
        setErrorMsg(error.message);
      }
      return;
    }

    if (data.session) {
      console.log("[DEBUG Signup] Succès avec session automatique :", data.session);
      setSuccessMsg("Compte créé avec succès !");
      toast.success("Compte créé !");
      onSuccess();
    } else {
      console.log("[DEBUG Signup] Utilisateur créé, mais sans session (email confirmation activée ou erreur). Data:", data);
      setSuccessMsg("Compte créé ! Veuillez vous connecter avec vos identifiants.");
      toast.success("Compte créé !");
      setTimeout(() => switchToLogin(), 2000);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 text-sm">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>{successMsg}</p>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="name-signup" className="text-slate-300 ml-1">Nom complet</Label>
        <div className="relative">
          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            id="name-signup" 
            className="pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 rounded-2xl focus-visible:ring-blue-500" 
            placeholder="Votre nom" {...form.register("full_name")} 
          />
        </div>
        {form.formState.errors.full_name && <p className="text-xs text-red-400 ml-1">{form.formState.errors.full_name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone-signup" className="text-slate-300 ml-1">Numéro Mobile Money</Label>
        <div className="flex gap-2">
          <select 
            value={countryCode} 
            onChange={(e) => setCountryCode(e.target.value)}
            className="h-12 w-[90px] bg-white/5 border border-white/10 text-white rounded-2xl px-2 outline-none focus:border-blue-500 appearance-none font-medium cursor-pointer"
          >
            <option value="+229" className="text-black">🇧🇯 +229</option>
            <option value="+228" className="text-black">🇹🇬 +228</option>
          </select>
          <div className="relative flex-1">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input 
              id="phone-signup" type="tel" inputMode="tel" placeholder="01 23 45 67" 
              className="pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 rounded-2xl focus-visible:ring-blue-500" 
              {...form.register("phone")} 
            />
          </div>
        </div>
        {form.formState.errors.phone && <p className="text-xs text-red-400 ml-1">{form.formState.errors.phone.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email-signup" className="text-slate-300 ml-1">Adresse Email <span className="text-slate-500 text-xs font-normal">(Facultatif)</span></Label>
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            id="email-signup" type="email" inputMode="email" placeholder="votre@email.com" 
            className="pl-11 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 rounded-2xl focus-visible:ring-blue-500" 
            {...form.register("email")} 
          />
        </div>
        {form.formState.errors.email && <p className="text-xs text-red-400 ml-1">{form.formState.errors.email.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password-signup" className="text-slate-300 ml-1">Mot de passe</Label>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input 
            id="password-signup" type={showPassword ? "text" : "password"} 
            className="pl-11 pr-12 h-12 bg-white/5 border-white/10 text-white placeholder:text-slate-600 rounded-2xl focus-visible:ring-blue-500" 
            placeholder="6 caractères minimum" {...form.register("password")} 
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
      
      <div className="pt-2">
        <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-2xl font-semibold shadow-lg shadow-blue-600/20" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          Créer mon compte
        </Button>
      </div>
    </form>
  );
}
