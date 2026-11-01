import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "client" | null;

export const DEFAULT_CLIENT_CREDENTIALS = {
  countryCode: "+229",
  phone: "97000000",
  fullPhone: "+22997000000",
  password: "client123",
  fullName: "Client Démo 3AS",
  id1xbet: "88992211",
};

export const MOCK_CLIENT_USER = {
  id: "client-demo-user-12345",
  email: "u22997000000@3asrecharge.app",
  phone: "+22997000000",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "phone" },
  user_metadata: {
    full_name: "Client Démo 3AS",
    phone: "+22997000000",
    id_1xbet: "88992211",
  },
  created_at: new Date().toISOString(),
} as unknown as User;

interface AuthCtx {
  user: User | null;
  session: Session | null;
  role: Role;
  loading: boolean;
  isVerified: boolean | null;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  loginAsDemo: (asRole?: Role) => void;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [isVerified, setIsVerified] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfileAndRole = async (uid: string) => {
    try {
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      if (!roleData || roleData.length === 0) setRole("client");
      else setRole(roleData.some((r) => r.role === "admin") ? "admin" : "client");

      const { data: profile } = await supabase.from("profiles").select("is_verified").eq("id", uid).single();
      setIsVerified(profile?.is_verified ?? true);
    } catch (e) {
      setRole("client");
      setIsVerified(true);
    }
  };

  const loginAsDemo = (asRole: Role = "client") => {
    const mockUser = MOCK_CLIENT_USER;
    const mockSession = {
      access_token: "mock-access-token-demo",
      token_type: "bearer",
      expires_in: 3600 * 24 * 7,
      refresh_token: "mock-refresh-token-demo",
      user: mockUser,
    } as unknown as Session;

    if (typeof window !== "undefined") {
      localStorage.setItem("3as_mock_session", JSON.stringify({ user: mockUser, session: mockSession, role: asRole }));
    }
    setUser(mockUser);
    setSession(mockSession);
    setRole(asRole);
    setIsVerified(true);
    setLoading(false);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const localMock = localStorage.getItem("3as_mock_session");
      if (localMock) {
        try {
          const parsed = JSON.parse(localMock);
          setUser(parsed.user);
          setSession(parsed.session);
          setRole(parsed.role || "client");
          setIsVerified(true);
          setLoading(false);
          return;
        } catch (e) {
          localStorage.removeItem("3as_mock_session");
        }
      }
    }

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
    }).catch(() => {
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("3as_mock_session");
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    }
    setUser(null);
    setSession(null);
    setRole(null);
    setIsVerified(null);
  };

  const refreshRole = async () => {
    if (user) await fetchProfileAndRole(user.id);
  };
  
  const refreshProfile = async () => {
    if (user) await fetchProfileAndRole(user.id);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, loading, isVerified, signOut, refreshRole, refreshProfile, loginAsDemo }}>
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
