import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "client" | null;

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role;
  loading: boolean;
  isVerified: boolean | null;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRole = async (uid: string) => {
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (!roleData || roleData.length === 0) setRole("client");
    else setRole(roleData.some((r) => r.role === "admin") ? "admin" : "client");

    const { data: profile } = await supabase.from("profiles").select("is_verified").eq("id", uid).single();
    setIsVerified(profile?.is_verified ?? false);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => fetchProfileAndRole(s.user.id), 0);
      } else {
        setRole(null);
        setIsVerified(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) fetchProfileAndRole(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshRole = async () => {
    if (user) await fetchProfileAndRole(user.id);
  };
  
  const refreshProfile = async () => {
    if (user) await fetchProfileAndRole(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, isVerified, signOut, refreshRole, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Convertit un numéro de téléphone en email interne pour Supabase */
export function phoneToEmail(phone: string): string {
  const clean = phone.replace(/[^\d]/g, "");
  return `u${clean}@3asrecharge.app`;
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}
