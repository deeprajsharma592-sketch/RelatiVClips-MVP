"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      { href: "/", label: "Workspace" },
      { href: "/services", label: "The Engine" },
      { href: "/plans", label: "Plans" },
      { href: "/signup", label: "Sign up" },
    ],
  },
  {
    title: "For",
    links: [
      { href: "/clippers", label: "Clippers" },
      { href: "/brands", label: "Brands" },
      { href: "/campaigns", label: "Campaigns" },
      { href: "/services", label: "Agencies" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/", label: "Changelog" },
      { href: "/", label: "Blog" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/", label: "Privacy" },
      { href: "/", label: "Terms" },
      { href: "/", label: "Security" },
      { href: "/", label: "Status" },
    ],
  },
];

const SOCIAL = [
  { label: "X", href: "/" },
  { label: "LinkedIn", href: "/" },
  { label: "GitHub", href: "/" },
  { label: "YouTube", href: "/" },
];

export default function Footer() {
  return (
    <footer
      className="relative overflow-hidden"
      style={{
        background:
          "linear-gradient(180deg, var(--color-bg-base) 0%, var(--color-bg-deep) 100%)",
        borderTop: "1px solid var(--color-border)",
      }}
    >
      {/* Decorative orbs */}
      <div
        className="absolute -top-40 left-1/4 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(217, 70, 239, 0.10) 0%, transparent 70%)",
        }}
      />
      <div
        className="absolute -bottom-40 right-1/4 w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)",
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-10">
        {/* Top — brand + tagline + newsletter */}
        <div className="grid lg:grid-cols-12 gap-12 pb-16" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <div className="lg:col-span-5">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #D97706 100%)",
                  boxShadow: "0 4px 12px rgba(252, 211, 77, 0.30), 0 1px 0 rgba(255,245,220,0.20) inset",
                }}
              >
                <span className="font-display text-base font-bold" style={{ color: "#1A1814" }}>R</span>
              </div>
              <span
                className="font-display text-xl font-semibold tracking-tight"
                style={{ color: "var(--color-text-primary)" }}
              >
                Relati<span className="text-gradient-sunset">V</span>
              </span>
            </Link>
            <p
              className="mt-5 text-[15px] leading-relaxed max-w-md"
              style={{ color: "var(--color-text-secondary)" }}
            >
              The viral clip engine for creators, brands, and the people who cut.
              Paste a URL, get ten clips.
            </p>

            {/* Status pill — live system indicator */}
            <div
              className="mt-7 inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full"
              style={{
                background: "var(--glass-light)",
                border: "1px solid var(--color-border)",
              }}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping"
                  style={{ background: "#10B981" }}
                />
                <span
                  className="relative inline-flex rounded-full h-2 w-2"
                  style={{ background: "#10B981" }}
                />
              </span>
              <span
                className="text-[12px] font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                All systems operational
              </span>
              <span
                className="text-[10px] font-mono"
                style={{ color: "var(--color-text-muted)" }}
              >
                · v2.0
              </span>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-8">
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <p
                  className="text-[11px] font-mono uppercase tracking-wider mb-4"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  {col.title}
                </p>
                <ul className="space-y-2.5">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[13px] transition-colors"
                        style={{ color: "var(--color-text-secondary)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-accent)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-text-secondary)")}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom — copyright + socials */}
        <div className="pt-8 flex flex-col-reverse md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center md:items-start gap-1">
            <p
              className="text-[12px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              ©RelatiV | 80 Galaxy Media
            </p>
            <p
              className="text-[11px]"
              style={{ color: "var(--color-text-muted)", opacity: 0.7 }}
            >
              Built in Assam, India · deployed globally
            </p>
          </div>

          <div className="flex items-center gap-3">
            {SOCIAL.map((s) => (
              <Link
                key={s.label}
                href={s.href}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                style={{
                  background: "var(--glass-light)",
                  border: "1px solid var(--color-border)",
                  color: "var(--color-text-secondary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--color-surface-2)";
                  e.currentTarget.style.borderColor = "rgba(255, 245, 220, 0.16)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "var(--glass-light)";
                  e.currentTarget.style.borderColor = "var(--color-border)";
                }}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Big wordmark — premium designer moment */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mt-20 text-center"
        >
          <p
            className="font-display font-semibold tracking-tight select-none"
            style={{
              fontSize: "clamp(4rem, 18vw, 14rem)",
              lineHeight: 0.85,
              color: "transparent",
              background: "linear-gradient(180deg, rgba(60, 50, 30, 0.12) 0%, rgba(60, 50, 30, 0.02) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
            }}
          >
            Relati<span style={{ fontFamily: "var(--font-serif)", fontStyle: "italic" }}>V</span>
          </p>
        </motion.div>
      </div>
    </footer>
  );
}
