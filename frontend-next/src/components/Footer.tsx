"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";

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
      { href: "/blog", label: "Blog" },
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
  const pathname = usePathname();
  const isAppOrAuthRoute =
    pathname?.startsWith("/dashboard") ||
    pathname?.startsWith("/onboarding") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password";

  if (isAppOrAuthRoute) return null;

  return (
    <footer className="relative z-[1] px-4 py-6 sm:px-8 lg:py-8">
      <div
        className="mx-auto max-w-7xl overflow-hidden rounded-[28px] border px-6 py-6 sm:px-10 sm:py-8 lg:px-16"
        style={{ background: "var(--color-surface-2)", borderColor: "var(--color-border)" }}
      >
        <div className="grid gap-9 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,2.85fr)] lg:gap-12">
          <div>
            <Link href="/" className="inline-flex items-center group" aria-label="RelatiV home">
              <BrandLogo
                iconWidth={48}
                wordmarkClassName="font-display text-xl font-semibold tracking-tight"
                wordmarkStyle={{ color: "var(--color-text-primary)" }}
              />
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
                className="text-[10px] font-mono inline-flex items-center gap-1"
                style={{ color: "var(--color-text-muted)" }}
              >
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold"
                  style={{
                    background: "rgba(252, 211, 77, 0.12)",
                    border: "1px solid rgba(252, 211, 77, 0.30)",
                    color: "#FCD34D",
                    letterSpacing: "0.08em",
                  }}
                >
                  BETA
                </span>
                · v2.0.0
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4">
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <p
                  className="mb-4 text-sm font-semibold"
                  style={{ color: "var(--color-text-primary)" }}
                >
                  {col.title}
                </p>
                <ul className="space-y-3">
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
        <div className="mt-6 flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--color-border)" }}>
          <div className="flex flex-col gap-1">
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
              Built in Bengaluru
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
      </div>
    </footer>
  );
}
