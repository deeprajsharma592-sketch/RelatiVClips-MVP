"use client";

import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/services", label: "Services" },
  { href: "/plans", label: "Plans" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-black">
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border border-accent rounded-[2px] flex items-center justify-center">
              <span className="font-mono text-[8px] text-accent font-bold">R</span>
            </div>
            <span className="font-display text-sm font-bold text-white tracking-tight">
              Relati<span className="text-accent">V</span>
            </span>
            <span className="text-xs font-mono text-text-muted">v2.0 [\u03A6]</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            {FOOTER_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-xs text-text-muted font-sans hover:text-white transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Tagline */}
          <p className="text-[10px] text-text-muted/60 font-mono">
            Quantum Precision \u2022 Privacy-First AI
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 text-center">
          <p className="text-[10px] text-text-muted/40 font-mono">
            &copy; {new Date().getFullYear()} RelatiV. All processing occurs locally. Zero data exfiltration.
          </p>
        </div>
      </div>
    </footer>
  );
}
