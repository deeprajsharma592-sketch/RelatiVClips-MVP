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
import { me as meFetch, logout as logoutFetch, type User } from "@/lib/auth";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
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
      const r = await meFetch();
      setUser(r?.user || null);
    } catch (e: any) {
      setError(e?.message || "Failed to load user");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutFetch();
    } finally {
      setUser(null);
      // Force a hard refresh so server components re-render
      window.location.href = "/";
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, error, refresh, logout }}>
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
