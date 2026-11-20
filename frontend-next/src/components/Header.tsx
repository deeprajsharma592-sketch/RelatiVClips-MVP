"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { ROLE_LABEL, type UserRole } from "@/lib/auth";
import ThemeToggle from "@/components/ThemeToggle";
import { getAppDashboardUrl } from "@/lib/domain";
import { SOLUTIONS_COLUMNS, SOLUTIONS_LIST } from "@/lib/solutionsData";

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
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { user, loading, logout } = useAuth();

  // Hide the global website header completely on Studio Dashboard and Onboarding
  if (pathname?.startsWith("/dashboard") || pathname?.startsWith("/onboarding")) {
    return null;
  }

  const handleMouseEnter = () => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
    setSolutionsOpen(true);
  };

  const handleMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setSolutionsOpen(false);
    }, 150);
  };

  // Clean nav links matching OpusClip reference (no changelog!)
  const navLinks: NavLink[] = [
    { href: "/", label: "Home" },
    { href: "/plans", label: "Pricing" },
    { href: "/blog", label: "Blog" },
    { href: "/about", label: "About" },
  ];

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setSolutionsOpen(false);
  }, []);
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
          <Link
            href="/"
            aria-current={pathname === "/" ? "page" : undefined}
            className={`text-sm font-medium transition-colors ${
              pathname === "/" ? "text-white font-semibold" : "text-zinc-400 hover:text-white"
            }`}
          >
            Home
          </Link>

          {/* Solutions Dropdown Menu (Exact match to uploaded image) */}
          <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => setSolutionsOpen((v) => !v)}
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors cursor-pointer py-2 ${
                solutionsOpen ? "text-white" : "text-zinc-400 hover:text-white"
              }`}
              aria-expanded={solutionsOpen}
            >
              <span>Solutions</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  solutionsOpen ? "rotate-180 text-white" : "text-zinc-500"
                }`}
              />
            </button>

            <AnimatePresence>
              {solutionsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.99 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-[820px] rounded-2xl border border-white/10 bg-[#0B0B0F]/98 backdrop-blur-2xl p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.85)] z-50 text-left"
                >
                  <div className="grid grid-cols-3 gap-6">
                    {SOLUTIONS_COLUMNS.map((col, colIdx) => (
                      <div key={colIdx} className="space-y-4">
                        {col.map((item) => (
                          <Link
                            key={item.id}
                            href={item.href}
                            onClick={() => setSolutionsOpen(false)}
                            className="group block p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                          >
                            <h4 className="text-[14px] font-semibold text-white group-hover:text-amber-300 transition-colors">
                              {item.title}
                            </h4>
                            <p className="text-[12px] text-zinc-400 leading-snug mt-1 group-hover:text-zinc-300 transition-colors">
                              {item.description}
                            </p>
                          </Link>
                        ))}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link
            href="/plans"
            className={`text-sm font-medium transition-colors ${
              pathname?.startsWith("/plans") ? "text-white font-semibold" : "text-zinc-400 hover:text-white"
            }`}
          >
            Pricing
          </Link>
          <Link
            href="/blog"
            className={`text-sm font-medium transition-colors ${
              pathname?.startsWith("/blog") ? "text-white font-semibold" : "text-zinc-400 hover:text-white"
            }`}
          >
            Blog
          </Link>
          <Link
            href="/about"
            className={`text-sm font-medium transition-colors ${
              pathname?.startsWith("/about") ? "text-white font-semibold" : "text-zinc-400 hover:text-white"
            }`}
          >
            About
          </Link>
        </nav>

        {/* Right Action Section */}
        <div className="flex items-center gap-3">
          {/* Auth State */}
          {!loading && !user && (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition"
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
            className="md:hidden border-t border-white/5 bg-[#08080A] px-6 py-4 space-y-3 text-sm"
          >
            <Link
              href="/"
              onClick={closeMenu}
              className="block py-1.5 text-zinc-400 hover:text-white"
            >
              Home
            </Link>

            {/* Mobile Solutions Accordion */}
            <div>
              <button
                onClick={() => setMobileSolutionsOpen(!mobileSolutionsOpen)}
                className="flex items-center justify-between w-full py-1.5 text-zinc-400 hover:text-white cursor-pointer"
              >
                <span>Solutions</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${
                    mobileSolutionsOpen ? "rotate-180 text-white" : "text-zinc-500"
                  }`}
                />
              </button>

              {mobileSolutionsOpen && (
                <div className="pl-3 mt-2 space-y-2.5 border-l border-white/10 py-1">
                  {SOLUTIONS_LIST.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={closeMenu}
                      className="block py-1"
                    >
                      <p className="text-xs font-semibold text-white">{item.title}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{item.description}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link
              href="/plans"
              onClick={closeMenu}
              className="block py-1.5 text-zinc-400 hover:text-white"
            >
              Pricing
            </Link>
            <Link
              href="/blog"
              onClick={closeMenu}
              className="block py-1.5 text-zinc-400 hover:text-white"
            >
              Blog
            </Link>
            <Link
              href="/about"
              onClick={closeMenu}
              className="block py-1.5 text-zinc-400 hover:text-white"
            >
              About
            </Link>

            <div className="pt-2 border-t border-white/5">
              <Link
                href="/dashboard"
                onClick={closeMenu}
                className="block py-2 text-white font-semibold"
              >
                Open Studio Dashboard →
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
