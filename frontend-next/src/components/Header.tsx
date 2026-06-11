"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NAV_LINKS = [
  { href: "/", label: "Workspace" },
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/plans", label: "Plans" },
  { href: "/contact", label: "Contact" },
];

export default function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

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
                [\u03A6]
              </span>
            )}
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`px-4 py-2 text-sm font-sans rounded-[2px] transition-colors ${
                isActive(link.href)
                  ? "text-white bg-white/5"
                  : "text-text-muted hover:text-white hover:bg-white/5"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right section: status + CTA + hamburger */}
        <div className="flex items-center gap-3">
          <motion.a
            href="#try-it"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-accent text-black text-sm font-semibold rounded-full hover:bg-accent-secondary transition-colors"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            Try it free
            <span className="text-xs">→</span>
          </motion.a>
          <div className="hidden md:flex items-center gap-2 pr-2">
            <motion.div
              className="w-2 h-2 rounded-full bg-accent-secondary"
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs font-mono text-text-muted">
              Online
            </span>
          </div>

          {/* Hamburger button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden flex flex-col items-center justify-center w-8 h-8 gap-1 border border-border rounded-[2px] hover:border-accent transition-colors"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <motion.span
              className="block w-4 h-px"
              style={{ backgroundColor: menuOpen ? "#FF6B35" : "#A1A1A1" }}
              animate={menuOpen ? { rotate: 45, y: 2.5 } : { rotate: 0, y: 0 }}
            />
            <motion.span
              className="block w-4 h-px"
              style={{ backgroundColor: "#A1A1A1" }}
              animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
            />
            <motion.span
              className="block w-4 h-px"
              style={{ backgroundColor: menuOpen ? "#FF6B35" : "#A1A1A1" }}
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
              className="fixed top-16 right-0 bottom-0 w-64 bg-surface border-l border-border md:hidden p-6 flex flex-col gap-2"
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

              <div className="mt-auto pt-6 border-t border-border">
                <p className="text-[10px] font-mono text-text-muted/40 text-center">
                  Quantum Precision \u2022 Privacy-First AI
                </p>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
