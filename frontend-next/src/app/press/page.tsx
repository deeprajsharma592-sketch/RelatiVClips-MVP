/**
 * /press — Brand kit and downloadable assets.
 *
 * Shows: logo at different sizes, color palette, typography, downloadable files.
 * Public page (no auth) so journalists / partners can grab what they need.
 */

import Link from "next/link";
import { ArrowRight, Download, Copy, Check } from "lucide-react";
import { Metadata } from "next";
import PressCopyButton from "./PressCopyButton";

export const metadata: Metadata = {
  title: "Press kit — RelatiV",
  description: "Download the RelatiV logo, brand colors, typography, and social cards. For press, partners, and creators who want to feature us.",
  alternates: { canonical: "/press" },
  openGraph: {
    title: "Press kit — RelatiV",
    description: "Logo, colors, type, and social cards. For press and partners.",
    url: "https://relativclips.com/press",
    images: ["/og-image.png"],
  },
};

const COLORS = [
  { name: "Cream", hex: "#F6F1E7", role: "Background" },
  { name: "Fuchsia", hex: "#D946EF", role: "Primary accent" },
  { name: "Coral", hex: "#FB7185", role: "Sunset start" },
  { name: "Violet", hex: "#8B5CF6", role: "Sunset end" },
  { name: "Ocean", hex: "#06B6D4", role: "Data · trust" },
  { name: "Emerald", hex: "#10B981", role: "Live · success" },
  { name: "Ink", hex: "#1A1814", role: "Body text" },
  { name: "Mute", hex: "#8B8472", role: "Meta · captions" },
];

const FONTS = [
  { name: "Space Grotesk", role: "Display + UI", weights: "400, 500, 600, 700", url: "https://fonts.google.com/specimen/Space+Grotesk" },
  { name: "Instrument Serif", role: "Editorial italic accent", weights: "400 (italic)", url: "https://fonts.google.com/specimen/Instrument+Serif" },
  { name: "JetBrains Mono", role: "Meta · monospace counters", weights: "400, 500", url: "https://fonts.google.com/specimen/JetBrains+Mono" },
];

const ASSETS = [
  { name: "Favicon", desc: "SVG, 64×64, 180×180", file: "/icon.svg", type: "image/svg+xml" },
  { name: "Apple touch icon", desc: "SVG, 180×180", file: "/apple-icon.svg", type: "image/svg+xml" },
  { name: "Open Graph (Facebook / LinkedIn)", desc: "PNG, 1200×630", file: "/og-image.png", type: "image/png" },
  { name: "Twitter card", desc: "PNG, 1200×675", file: "/twitter-card.png", type: "image/png" },
];

export default function PressPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[60vh] flex items-center overflow-hidden pt-32 pb-16">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div
            className="absolute top-0 right-1/4 h-[500px] w-[500px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(217, 70, 239, 0.18) 0%, transparent 70%)" }}
          />
          <div
            className="absolute bottom-0 left-1/4 h-[400px] w-[400px] rounded-full blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(6, 182, 212, 0.14) 0%, transparent 70%)" }}
          />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>01</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Press kit</span>
          </div>

          <h1
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)", lineHeight: 0.98 }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Brand assets. </span>
            <span className="hero-text text-gradient-sunset">For press, partners, creators.</span>
          </h1>
          <p className="mt-6 text-lg max-w-2xl mx-auto" style={{ color: "var(--color-text-secondary)" }}>
            Logo, colors, type, social cards. Use the mark and palette consistently — the brand depends on it.
          </p>
        </div>
      </section>

      {/* Logo */}
      <section className="relative py-20 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>02</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Logo</span>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {/* Default — full color */}
            <div className="glass-panel p-10 flex flex-col items-center justify-center min-h-[220px]">
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{
                  background: "var(--gradient-sunset)",
                  boxShadow: "0 8px 24px rgba(217, 70, 239, 0.30)",
                }}
              >
                <span className="font-display text-4xl font-bold text-white">R</span>
              </div>
              <p className="mt-5 font-display text-2xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
                Relati<span className="text-gradient-sunset">V</span>
              </p>
              <p className="mt-1 text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Default</p>
            </div>

            {/* Dark */}
            <div className="p-10 flex flex-col items-center justify-center min-h-[220px] rounded-[var(--radius-xl)]" style={{ background: "#1A1814" }}>
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center"
                style={{ background: "var(--gradient-sunset)", boxShadow: "0 8px 24px rgba(217, 70, 239, 0.40)" }}
              >
                <span className="font-display text-4xl font-bold text-white">R</span>
              </div>
              <p className="mt-5 font-display text-2xl font-semibold tracking-tight text-white">
                Relati<span style={{ background: "linear-gradient(135deg, #FB7185 0%, #D946EF 50%, #8B5CF6 100%)", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent" }}>V</span>
              </p>
              <p className="mt-1 text-[11px] font-mono uppercase tracking-wider" style={{ color: "#8B8472" }}>On dark</p>
            </div>

            {/* Mono / favicon size */}
            <div className="glass-card p-10 flex flex-col items-center justify-center min-h-[220px]">
              <div className="flex items-end gap-3">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-sunset)" }}>
                  <span className="font-display text-2xl font-bold text-white">R</span>
                </div>
                <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "var(--gradient-sunset)" }}>
                  <span className="font-display text-base font-bold text-white">R</span>
                </div>
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "var(--gradient-sunset)" }}>
                  <span className="font-display text-[10px] font-bold text-white">R</span>
                </div>
              </div>
              <p className="mt-5 text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Scales 16 → 180px</p>
            </div>
          </div>
        </div>
      </section>

      {/* Color palette */}
      <section className="relative py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>03</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Palette</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {COLORS.map((c) => (
              <div key={c.hex} className="glass-card p-5">
                <div
                  className="w-full h-24 rounded-2xl mb-3"
                  style={{ background: c.hex, border: "1px solid rgba(60,50,30,0.10)" }}
                />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{c.name}</p>
                    <p className="text-[10px] font-mono" style={{ color: "var(--color-text-muted)" }}>{c.role}</p>
                  </div>
                  <PressCopyButton text={c.hex} />
                </div>
                <code className="block mt-2 text-[11px] font-mono" style={{ color: "var(--color-text-secondary)" }}>{c.hex}</code>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="relative py-20 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>04</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Type</span>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {FONTS.map((f) => (
              <div key={f.name} className="glass-card p-6">
                <p className="text-[10px] font-mono uppercase tracking-wider mb-3" style={{ color: "var(--color-text-muted)" }}>{f.role}</p>
                <p
                  className="mb-4"
                  style={{
                    fontFamily: f.name,
                    fontSize: f.name === "Instrument Serif" ? "2.5rem" : "1.75rem",
                    fontStyle: f.name === "Instrument Serif" ? "italic" : "normal",
                    fontWeight: f.name === "Instrument Serif" ? 400 : 600,
                    color: "var(--color-text-primary)",
                    lineHeight: 1.1,
                  }}
                >
                  {f.name === "Instrument Serif" ? "Designer moments" : "The viral clip engine"}
                </p>
                <p className="text-[13px] mb-3" style={{ color: "var(--color-text-secondary)" }}>{f.name}</p>
                <div className="flex items-center justify-between text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>
                  <span>{f.weights}</span>
                  <a href={f.url} target="_blank" rel="noopener" className="font-semibold" style={{ color: "var(--color-accent)" }}>
                    Get font ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Downloadable assets */}
      <section className="relative py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>05</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Downloads</span>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {ASSETS.map((a) => (
              <a
                key={a.file}
                href={a.file}
                download
                className="glass-card hover-glow p-5 flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: "var(--gradient-sunset)", boxShadow: "0 4px 12px rgba(217, 70, 239, 0.20)" }}
                  >
                    <Download className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[14px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{a.name}</p>
                    <p className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>{a.desc}</p>
                  </div>
                </div>
                <span className="text-[12px] font-mono" style={{ color: "var(--color-accent)" }}>↓ {a.file.split("/").pop()}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Email templates (download) */}
      <section className="relative py-20 overflow-hidden" style={{ borderTop: "1px solid rgba(60, 50, 30, 0.08)" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>06</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Email templates</span>
          </div>

          <p className="text-[15px] mb-6 max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
            5 transactional HTML templates built with the same brand system. Drop into Postmark, Resend, SendGrid, or any SMTP provider.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { name: "Welcome", desc: "After signup", file: "/emails/welcome.html" },
              { name: "Password reset", desc: "1-hour expiry link", file: "/emails/password-reset.html" },
              { name: "Verify email", desc: "24-hour expiry link", file: "/emails/verify-email.html" },
              { name: "Campaign match", desc: "Clipper network notification", file: "/emails/campaign-match.html" },
              { name: "Payout sent", desc: "Monday receipt with breakdown", file: "/emails/payout-sent.html" },
            ].map((e) => (
              <a
                key={e.file}
                href={e.file}
                target="_blank"
                rel="noopener"
                className="glass-card hover-glow p-4 flex items-center gap-3"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: "var(--gradient-sunset)" }}
                />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>{e.name}</p>
                  <p className="text-[10px] font-mono truncate" style={{ color: "var(--color-text-muted)" }}>{e.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-32 overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-[11px] font-mono" style={{ color: "var(--color-text-muted)" }}>07</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
            <span className="text-[11px] font-mono uppercase tracking-wider" style={{ color: "var(--color-text-muted)" }}>Need more?</span>
            <span className="h-px w-12" style={{ background: "var(--color-border-strong)" }} />
          </div>
          <h2
            className="font-display font-semibold tracking-tight"
            style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.5rem)", lineHeight: 1.05 }}
          >
            <span style={{ color: "var(--color-text-primary)" }}>Need the source files, </span>
            <span className="hero-text text-gradient-ocean">or a custom variant?</span>
          </h2>
          <p className="mt-5 text-lg" style={{ color: "var(--color-text-secondary)" }}>
            Email <a href="mailto:press@relativ.video" style={{ color: "var(--color-accent)", fontWeight: 600 }}>press@relativ.video</a> — we usually reply within a few hours.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/" className="btn-primary btn-shine inline-flex items-center gap-2">
              Back to homepage
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="mailto:press@relativ.video" className="btn-ghost inline-flex items-center gap-2">
              Email the team
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
