"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { ROLE_LABEL, type UserRole } from "@/lib/auth";

const NAV_LINKS = [
  { href: "/", label: "Workspace" },
  { href: "/clippers", label: "Clippers", highlight: true },
  { href: "/brands", label: "Brands", highlight: true },
  { href: "/campaigns", label: "Campaigns", highlight: true },
  { href: "/services", label: "Services" },
  { href: "/plans", label: "Plans" },
];

const ROLE_GRADIENT: Record<UserRole, string> = {
  creator: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)",
  brand: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)",
  clipper: "linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)",
};

const DASHBOARD_HREF: Record<UserRole, string> = {
  creator: "/creators/dashboard",
  brand: "/brands/dashboard",
  clipper: "/clippers/dashboard",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, loading, logout } = useAuth();

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const handleLogout = async () => {
    closeUserMenu();
    await logout();
  };

  return (
    <header className="sticky top-0 z-50">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: "rgba(24, 22, 18, 0.72)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "1px solid rgba(255, 245, 220, 0.08)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.30)",
        }}
      />
      <div className="max-w-7xl mx-auto px-6 h-[68px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group" onClick={closeMenu}>
          <motion.div
            className="w-9 h-9 rounded-xl flex items-center justify-center relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #D97706 100%)",
              boxShadow: "0 4px 12px rgba(252, 211, 77, 0.30), 0 1px 0 rgba(255,245,220,0.20) inset",
            }}
            whileHover={{ scale: 1.05, rotate: -5 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <span className="font-display text-base font-bold" style={{ color: "#1A1814" }}>R</span>
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,245,220,0.30) 0%, transparent 60%)",
                pointerEvents: "none",
              }}
            />
          </motion.div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-display text-lg font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
              Relati<span className="text-gradient-sunset">V</span>
            </span>
            {pathname === "/" && (
              <span className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                [Φ]
              </span>
            )}
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className="relative px-3.5 py-2 text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-1.5"
                style={{
                  color: active
                    ? "var(--color-text-primary)"
                    : "var(--color-text-secondary)",
                  background: active
                    ? "rgba(252, 211, 77, 0.10)"
                    : "transparent",
                  boxShadow: active
                    ? "0 1px 3px rgba(252, 211, 77, 0.15), 0 1px 0 rgba(255,245,220,0.08) inset, 0 0 12px rgba(252, 211, 77, 0.10)"
                    : "none",
                }}
              >
                {link.label}
                {link.highlight && !active && (
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--gradient-sunset)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Online indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(31, 29, 23, 0.60)", border: "1px solid rgba(255, 245, 220, 0.08)" }}>
            <motion.div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: "#10B981" }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>
              Online
            </span>
          </div>

          {/* Auth state */}
          {!loading && !user && (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-block text-sm font-medium px-3 py-1.5 rounded-full transition-colors"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="hidden md:inline-flex items-center gap-2 text-sm font-semibold rounded-full transition-all"
                style={{
                  background: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #D97706 100%)",
                  color: "#1A1814",
                  padding: "9px 18px",
                  boxShadow: "0 4px 16px rgba(252, 211, 77, 0.35), 0 1px 0 rgba(255,245,220,0.20) inset, 0 0 0 1px rgba(252, 211, 77, 0.20)",
                }}
              >
                Get started
                <span className="text-xs">→</span>
              </Link>
            </>
          )}
          {!loading && user && (
            <div className="relative hidden sm:block">
              <button
                onClick={() => setUserMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1 rounded-full transition-all"
                style={{ background: "rgba(31, 29, 23, 0.60)", border: "1px solid rgba(255, 245, 220, 0.08)" }}
                aria-label="User menu"
                aria-expanded={userMenuOpen}
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center font-display font-bold text-sm text-white"
                  style={{ background: ROLE_GRADIENT[user.role] }}
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left pr-2">
                  <div className="text-xs font-semibold leading-tight" style={{ color: "var(--color-text-primary)" }}>
                    {user.name}
                  </div>
                  <div className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                    {ROLE_LABEL[user.role]}
                  </div>
                </div>
              </button>
              <AnimatePresence>
                {userMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={closeUserMenu}
                      aria-hidden="true"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-60 overflow-hidden z-40"
                      style={{
                        background: "rgba(31, 29, 23, 0.92)",
                        backdropFilter: "blur(32px) saturate(180%)",
                        WebkitBackdropFilter: "blur(32px) saturate(180%)",
                        border: "1px solid rgba(255, 245, 220, 0.10)",
                        borderRadius: "var(--radius-lg)",
                        boxShadow: "0 24px 64px rgba(0, 0, 0, 0.55), 0 1px 0 rgba(255, 245, 220, 0.06) inset",
                      }}
                    >
                      <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(255, 245, 220, 0.08)" }}>
                        <div className="text-sm font-semibold truncate" style={{ color: "var(--color-text-primary)" }}>
                          {user.name}
                        </div>
                        <div className="text-[10px] font-mono truncate" style={{ color: "var(--color-text-muted)" }}>
                          {user.email}
                        </div>
                      </div>
                      <Link
                        href="/account"
                        onClick={closeUserMenu}
                        className="block px-4 py-2.5 text-sm transition-colors"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        Account
                      </Link>
                      <Link
                        href={DASHBOARD_HREF[user.role]}
                        onClick={closeUserMenu}
                        className="block px-4 py-2.5 text-sm transition-colors"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        {ROLE_LABEL[user.role]} dashboard
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2.5 text-sm transition-colors border-t"
                        style={{ color: "var(--color-error)", borderColor: "rgba(255, 245, 220, 0.08)" }}
                      >
                        Sign out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col items-center justify-center w-9 h-9 rounded-xl transition-colors"
            style={{ background: "rgba(31, 29, 23, 0.60)", border: "1px solid rgba(255, 245, 220, 0.08)" }}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <motion.span
              className="block w-4 h-px"
              style={{ backgroundColor: "var(--color-text-primary)" }}
              animate={menuOpen ? { rotate: 45, y: 3 } : { rotate: 0, y: 0 }}
            />
            <motion.span
              className="block w-4 h-px my-0.5"
              style={{ backgroundColor: "var(--color-text-primary)" }}
              animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
            />
            <motion.span
              className="block w-4 h-px"
              style={{ backgroundColor: "var(--color-text-primary)" }}
              animate={menuOpen ? { rotate: -45, y: -3 } : { rotate: 0, y: 0 }}
            />
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 md:hidden"
              style={{ background: "rgba(0, 0, 0, 0.60)", backdropFilter: "blur(8px)" }}
              onClick={closeMenu}
            />
            <motion.nav
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-[68px] right-0 bottom-0 w-72 overflow-y-auto p-6 flex flex-col gap-1 md:hidden"
              style={{
                background: "rgba(31, 29, 23, 0.92)",
                backdropFilter: "blur(32px) saturate(180%)",
                WebkitBackdropFilter: "blur(32px) saturate(180%)",
                borderLeft: "1px solid rgba(255, 245, 220, 0.08)",
                boxShadow: "0 24px 64px rgba(0, 0, 0, 0.55)",
              }}
            >
              {NAV_LINKS.map((link, i) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className="flex items-center justify-between px-4 py-3 text-sm font-medium rounded-2xl transition-colors"
                    style={{
                      color: isActive(link.href)
                        ? "var(--color-text-primary)"
                        : "var(--color-text-secondary)",
                      background: isActive(link.href)
                        ? "rgba(252, 211, 77, 0.10)"
                        : "transparent",
                    }}
                  >
                    {link.label}
                    {link.highlight && !isActive(link.href) && (
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: "var(--gradient-sunset)" }}
                      />
                    )}
                  </Link>
                </motion.div>
              ))}

              <div className="mt-auto pt-6 space-y-2" style={{ borderTop: "1px solid rgba(255, 245, 220, 0.08)" }}>
                {!loading && !user && (
                  <>
                    <Link
                      href="/login"
                      onClick={closeMenu}
                      className="block text-center py-3 text-sm font-medium rounded-full"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/signup"
                      onClick={closeMenu}
                      className="block text-center py-3 text-sm font-semibold rounded-full"
                      style={{
                        background: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #D97706 100%)",
                        color: "#1A1814",
                        boxShadow: "0 4px 16px rgba(252, 211, 77, 0.30)",
                      }}
                    >
                      Get started →
                    </Link>
                  </>
                )}
                {!loading && user && (
                  <>
                    <div className="text-xs px-2" style={{ color: "var(--color-text-muted)" }}>
                      Signed in as <span style={{ color: "var(--color-text-primary)" }}>{user.name}</span>
                    </div>
                    <Link
                      href="/account"
                      onClick={closeMenu}
                      className="block px-4 py-2.5 text-sm rounded-xl"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
                      Account
                    </Link>
                    <button
                      onClick={() => {
                        closeMenu();
                        handleLogout();
                      }}
                      className="block w-full text-left px-4 py-2.5 text-sm rounded-xl"
                      style={{ color: "var(--color-error)" }}
                    >
                      Sign out
                    </button>
                  </>
                )}
                <p className="text-[10px] font-mono text-center pt-4" style={{ color: "var(--color-text-faint)" }}>
                  Quantum Precision • Privacy-First AI
                </p>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
