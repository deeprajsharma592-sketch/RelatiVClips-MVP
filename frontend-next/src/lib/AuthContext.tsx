"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { me as getCurrentUser, logout as signOut, type User } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: (silent?: boolean) => Promise<void>;
  logout: (redirectTo?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const response = await getCurrentUser();
      const nextUser = response?.user || null;
      setUser((current) =>
        nextUser?.profile_pending && current?.id === nextUser.id && !current.profile_pending
          ? current
          : nextUser
      );
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : "Could not check your account session.");
      // Keep existing signed-in user on transient network/backend errors instead of logging them out
      if (!userRef.current) {
        setUser(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const ensureFreshSession = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) return;
      const nowSec = Math.floor(Date.now() / 1000);
      // Proactively refresh if token is expired or expires within 5 minutes
      if (!session.expires_at || session.expires_at - nowSec < 300) {
        await supabase.auth.refreshSession();
      }
    } catch {
      // Non-fatal; next API or auth check will retry
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh(false);
    let unsubscribe = () => {};
    try {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          setUser(null);
          setLoading(false);
          return;
        }
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          window.setTimeout(() => void refresh(true), 0);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // refresh() surfaces the missing-project configuration to the UI.
    }

    // Wake-up & idle recovery: browsers throttle background timers, so refresh
    // the session as soon as the user returns to the tab or focuses the window.
    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      void ensureFreshSession();
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    // Periodic keep-alive every 10 minutes while active
    const keepAliveTimer = window.setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        void ensureFreshSession();
      }
    }, 10 * 60 * 1000);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.clearInterval(keepAliveTimer);
    };
  }, [refresh, ensureFreshSession]);

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
