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

const ROLE_COLOR: Record<UserRole, string> = {
  creator: "var(--color-accent)",
  brand: "var(--color-accent)",
  clipper: "var(--color-accent-tertiary)",
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
    // logout() in AuthContext does window.location.href = "/"
  };

  return (
    <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group" onClick={closeMenu}>
          <motion.div
            className="w-8 h-8 border border-accent rounded-[2px] flex items-center justify-center"
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.3 }}
          >
            <span className="font-mono text-xs text-accent font-bold">R</span>
          </motion.div>
          <div>
            <span className="font-display text-lg font-bold text-white tracking-tight">
              Relati<span className="text-accent">V</span>
            </span>
            {pathname === "/" && (
              <span className="ml-2 text-[10px] font-mono text-accent-secondary">
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
                className={`px-4 py-2 text-sm font-sans rounded-[var(--radius-md)] transition-colors flex items-center gap-1.5 ${
                  active
                    ? "text-text-primary bg-[color:var(--color-surface-2)]"
                    : link.highlight
                    ? "text-text-secondary hover:text-[color:var(--color-accent-tertiary)]"
                    : "text-text-muted hover:text-text-primary hover:bg-[color:var(--color-surface-2)]"
                }`}
              >
                {link.label}
                {link.highlight && !active && (
                  <span className="h-1 w-1 rounded-full bg-[color:var(--color-accent-tertiary)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right section: auth state + status + CTA + hamburger */}
        <div className="flex items-center gap-3">
          {/* Auth state: signed out → Sign in / Sign up. Signed in → avatar. */}
          {!loading && !user && (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-block text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-accent text-black text-sm font-semibold rounded-full hover:bg-accent-secondary transition-colors"
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
                className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-[color:var(--color-surface-2)] transition-colors"
                aria-label="User menu"
                aria-expanded={userMenuOpen}
              >
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center font-display font-bold text-sm text-[color:var(--color-bg-base)]"
                  style={{ background: ROLE_COLOR[user.role] }}
                >
                  {user.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-text-primary leading-tight">{user.name}</div>
                  <div className="text-[10px] font-mono text-text-muted">{ROLE_LABEL[user.role]}</div>
                </div>
                <span className="text-text-faint text-[10px]">▼</span>
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
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 mt-2 w-56 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface-elev)] shadow-2xl py-1 z-40"
                    >
                      <div className="px-4 py-2 border-b border-[color:var(--color-border)]">
                        <div className="text-sm font-semibold text-text-primary truncate">{user.name}</div>
                        <div className="text-[10px] font-mono text-text-muted truncate">{user.email}</div>
                      </div>
                      <Link
                        href="/account"
                        onClick={closeUserMenu}
                        className="block px-4 py-2 text-sm text-text-secondary hover:bg-[color:var(--color-surface-2)] hover:text-text-primary"
                      >
                        Account
                      </Link>
                      <Link
                        href={DASHBOARD_HREF[user.role]}
                        onClick={closeUserMenu}
                        className="block px-4 py-2 text-sm text-text-secondary hover:bg-[color:var(--color-surface-2)] hover:text-text-primary"
                      >
                        {ROLE_LABEL[user.role]} dashboard
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-text-secondary hover:bg-[color:var(--color-surface-2)] hover:text-[color:var(--color-error)]"
                      >
                        Sign out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="hidden md:flex items-center gap-2 pr-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-accent-secondary"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs font-mono text-text-muted">Online</span>
          </div>

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col items-center justify-center w-8 h-8 gap-1 border border-border rounded-[2px] hover:border-accent transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <motion.span
              className="block w-4 h-px"
              style={{ backgroundColor: menuOpen ? "#D946EF" : "#A1A1A1" }}
              animate={menuOpen ? { rotate: 45, y: 2.5 } : { rotate: 0, y: 0 }}
            />
            <motion.span
              className="block w-4 h-px"
              style={{ backgroundColor: "#A1A1A1" }}
              animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
            />
            <motion.span
              className="block w-4 h-px"
              style={{ backgroundColor: menuOpen ? "#D946EF" : "#A1A1A1" }}
              animate={menuOpen ? { rotate: -45, y: -2.5 } : { rotate: 0, y: 0 }}
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={closeMenu}
            />
            <motion.nav
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed top-16 right-0 bottom-0 w-64 bg-surface border-l border-border md:hidden p-6 flex flex-col gap-2 overflow-y-auto"
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
                    className={`block px-4 py-3 text-sm font-sans rounded-[2px] transition-colors ${
                      isActive(link.href)
                        ? "text-white bg-accent/10 border border-accent/20"
                        : "text-text-muted hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}

              {/* Mobile auth section */}
              <div className="mt-auto pt-6 border-t border-border space-y-2">
                {!loading && !user && (
                  <>
                    <Link
                      href="/login"
                      onClick={closeMenu}
                      className="block px-4 py-2 text-sm text-text-muted text-center hover:text-text-primary"
                    >
                      Sign in
                    </Link>
                    <Link
                      href="/signup"
                      onClick={closeMenu}
                      className="block px-4 py-2 text-sm text-text-center bg-accent text-black font-semibold rounded-md"
                    >
                      Get started
                    </Link>
                  </>
                )}
                {!loading && user && (
                  <>
                    <div className="px-4 py-2 text-xs text-text-muted">
                      Signed in as <span className="text-text-primary">{user.name}</span>
                    </div>
                    <Link
                      href="/account"
                      onClick={closeMenu}
                      className="block px-4 py-2 text-sm text-text-muted hover:text-white"
                    >
                      Account
                    </Link>
                    <button
                      onClick={() => {
                        closeMenu();
                        handleLogout();
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-text-muted hover:text-white"
                    >
                      Sign out
                    </button>
                  </>
                )}
                <p className="text-[10px] font-mono text-text-muted/40 text-center pt-4">
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
