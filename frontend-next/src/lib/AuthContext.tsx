"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { me as getCurrentUser, logout as signOut, type User } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: (redirectTo?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCurrentUser();
      setUser(response?.user || null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not check your account session.");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async (redirectTo = "/") => {
    try {
      await signOut();
    } finally {
      setUser(null);
      window.location.assign(redirectTo);
    }
  }, []);

  useEffect(() => {
    // Initial hydration and auth changes both read the current session. Defer
    // the callback work to avoid making Supabase requests inside its lock.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    let unsubscribe = () => {};
    try {
      const { data } = getSupabaseBrowserClient().auth.onAuthStateChange(() => {
        window.setTimeout(() => void refresh(), 0);
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // refresh() surfaces the missing-project configuration to the UI.
    }
    return () => unsubscribe();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
