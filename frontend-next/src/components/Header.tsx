"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { ROLE_LABEL, type UserRole } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { getAppDashboardUrl } from "@/lib/domain";

interface NavLink {
  href: string;
  label: string;
}

const DASHBOARD_HREF: Record<UserRole, string> = {
  creator: "/dashboard",
  brand: "/brands/dashboard",
  clipper: "/clippers/dashboard",
};

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user, loading, logout } = useAuth();

  // Hide the global website header completely on Studio Dashboard and Onboarding
  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/onboarding")) {
    return null;
  }

  // Clean nav links matching OpusClip reference (no changelog!)
  const navLinks: NavLink[] = [
    { href: "/", label: "Home" },
    { href: "/plans", label: "Pricing" },
    { href: "/blog", label: "Blog" },
    { href: "/about", label: "About" },
  ];

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeUserMenu = useCallback(() => setUserMenuOpen(false), []);

  const isActive = (href: string) => {
    if (href.startsWith("http")) return false;
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  };

  const handleLogout = async () => {
    closeUserMenu();
    await logout();
  };

  return (
    <header className="sticky top-0 z-50 bg-[#08080A]/95 backdrop-blur-md border-b border-white/[0.08]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Brand Logo (Clean, crisp white) */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group" onClick={closeMenu}>
            <span className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-black font-black text-sm tracking-tighter">
              R
            </span>
            <span className="text-base font-bold text-white tracking-tight">
              RelatiV
            </span>
          </Link>
        </div>

        {/* Center Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`text-sm font-medium transition-colors ${
                  active ? "text-white font-semibold" : "text-zinc-400 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action Section */}
        <div className="flex items-center gap-3">
          {/* Auth State */}
          {!loading && !user && (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-block text-xs font-medium text-zinc-400 hover:text-white px-3 py-2 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition"
              >
                My dashboard
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-bold text-black bg-white hover:bg-zinc-200 transition shadow-sm"
              >
                Get started
              </Link>
            </>
          )}

          {!loading && user && (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition"
              >
                Open Studio
              </Link>
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 p-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
                  aria-label="User menu"
                  aria-expanded={userMenuOpen}
                >
                  <div className="h-7 w-7 rounded-md bg-zinc-800 border border-white/15 flex items-center justify-center font-bold text-xs text-white">
                    {user.name.slice(0, 1).toUpperCase()}
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
                        initial={{ opacity: 0, y: -6, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#0E0E12] p-2 shadow-2xl z-40 space-y-1 text-xs"
                      >
                        <div className="px-3 py-2 border-b border-white/5">
                          <p className="font-semibold text-white truncate">{user.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
                        </div>
                        <Link
                          href="/dashboard"
                          onClick={closeUserMenu}
                          className="block px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 transition"
                        >
                          Studio Dashboard
                        </Link>
                        <Link
                          href="/account"
                          onClick={closeUserMenu}
                          className="block px-3 py-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 transition"
                        >
                          Account Settings
                        </Link>
                        <button
                          onClick={handleLogout}
                          className="w-full text-left px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
                        >
                          Sign out
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </>
          )}

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/5 bg-[#08080A] px-6 py-4 space-y-2 text-sm"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeMenu}
                className="block py-2 text-zinc-400 hover:text-white"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/dashboard"
              onClick={closeMenu}
              className="block py-2 text-cyan-400 font-semibold"
            >
              My Dashboard →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
