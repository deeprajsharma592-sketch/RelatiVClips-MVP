"use client";

/**
 * AuthProvider — exposes the current user (or null) to the React tree.
 *
 * The backend's HttpOnly cookie is the source of truth. We don't store
 * the user object in localStorage; we re-fetch from /me on mount and
 * after every auth mutation. The browser sends the cookie automatically.
 *
 * Usage:
 *   const { user, loading, refresh, logout } = useAuth();
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { me as meFetch, logout as logoutFetch, type User, type UserRole } from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: (redirectTo?: string) => Promise<void>;
  loginAsDemo: (name?: string, email?: string, role?: UserRole) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_STORAGE_KEY = "relativ_demo_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loginAsDemo = useCallback((name = "Deepraj Sharma", email = "deepraj@relativclips.com", role: UserRole = "creator") => {
    const demoUser: User = {
      id: "demo-" + Math.random().toString(36).substring(2, 9),
      name,
      email,
      role,
      is_verified: true,
      created_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
      profile: { specialty: "podcasts" },
    };
    try {
      localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoUser));
      document.cookie = "relativ_demo_session=1; path=/; max-age=86400; SameSite=Lax";
    } catch {}
    setUser(demoUser);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await meFetch();
      if (r?.user) {
        // A real backend session always takes precedence over a leftover demo
        // identity from this browser.
        if (typeof window !== "undefined") {
          localStorage.removeItem(DEMO_STORAGE_KEY);
          document.cookie = "relativ_demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
        }
        setUser(r.user);
        return;
      }

      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(DEMO_STORAGE_KEY);
        if (stored) {
          try {
            setUser(JSON.parse(stored));
            return;
          } catch {}
        }
      }
      setUser(null);
    } catch (e: unknown) {
      // If backend is offline but demo user exists
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(DEMO_STORAGE_KEY);
        if (stored) {
          try {
            setUser(JSON.parse(stored));
            setLoading(false);
            return;
          } catch {}
        }
      }
      setError(e instanceof Error ? e.message : "Failed to load user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async (redirectTo = "/") => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(DEMO_STORAGE_KEY);
        document.cookie = "relativ_demo_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      }
      await logoutFetch();
    } finally {
      setUser(null);
      // Force a hard refresh so server components re-render
      window.location.href = redirectTo;
    }
  }, []);

  useEffect(() => {
    // Initial session lookup hydrates the auth state from the backend.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh, logout, loginAsDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
