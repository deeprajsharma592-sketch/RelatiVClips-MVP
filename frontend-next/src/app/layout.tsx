import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono, Fraunces, Geist, Geist_Mono, Bebas_Neue } from "next/font/google";
import Header from "@/components/Header";
import ValuePropBar from "@/components/ValuePropBar";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import CustomCursor from "@/components/CustomCursor";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/lib/AuthContext";
import "./globals.css";

// Display: Space Grotesk for headlines, with explicit weight + optical size
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// Body: Geist Sans — Vercel's own font, modern, premium, tight tracking
const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// Mono: Geist Mono — pairs with Geist Sans for code, KPIs, technical labels
const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

// Bebas Neue — condensed display font for massive Apple-style headlines
const bebasNeue = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Italic display: Fraunces (variable, opsz, SOFT, WONK axes) — premium serif italic accents
// Dropped Instrument Serif — Fraunces handles all italic display duties
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "RelatiV (Beta) — Viral clips, picked by AI, finished in minutes",
  description:
    "Paste a YouTube link. Get 10 ready-to-post clips in 5 minutes. Taste-based selection, designer captions, your brand colors. Built for podcasters, brands, and creators who ship. Now in public beta.",
  metadataBase: new URL("https://relativclips.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    locale: "en_US",
    url: "https://relativclips.com",
    siteName: "RelatiV",
    title: "RelatiV (Beta) — Turn one video into ten viral clips in 60 seconds",
    description:
      "Paste a YouTube link. Get 10 ready-to-post clips in 5 minutes. Taste-based AI selection, designer captions, your brand colors. Built for podcasters, brands, and creators who ship. Now in public beta.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RelatiV (Beta) — viral clip engine. Turn one video into ten viral clips in 60 seconds.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RelatiV (Beta) — Turn one video into ten viral clips in 60 seconds",
    description:
      "Paste a YouTube link. Get 10 ready-to-post clips in 5 minutes. Taste-based AI selection, designer captions, your brand colors. Now in public beta.",
    images: ["/twitter-card.png"],
    creator: "@relativclips",
    site: "@relativclips",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  applicationName: "RelatiV",
  authors: [{ name: "80 Galaxy Media" }],
  generator: "Next.js",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

// ─── JSON-LD structured data (Organization + SoftwareApplication) ─────
// Injected into every page via the root layout. Helps Google / Bing
// build a knowledge graph entry for RelatiV.
const ORG_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "RelatiV",
  legalName: "80 Galaxy Media",
  url: "https://relativclips.com",
  logo: "https://relativclips.com/icon.svg",
  description:
    "RelatiV turns one long video into ten ready-to-post short-form clips in minutes. Taste-based AI selection, designer captions, and a 3-sided marketplace for creators, brands, and clippers.",
  foundingDate: "2026",
  sameAs: [
    "https://x.com/relativclips",
    "https://github.com/deeprajsharma592-sketch/RelatiVClips-MVP",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: "https://relativclips.com/contact",
    availableLanguage: ["en"],
  },
};

const APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "RelatiV",
  applicationCategory: "MultimediaApplication",
  applicationSubCategory: "Video Editing Software",
  applicationStatus: "https://schema.org/Beta",  // ← BETA marker for SEO
  softwareVersion: "2.0.0-beta",
  operatingSystem: "Web",
  url: "https://relativclips.com",
  description:
    "Paste a YouTube link. Get 10 ready-to-post short-form clips in 5 minutes. Taste-based AI selection, designer captions, brand colors. 3-sided marketplace for creators, brands, and clippers. Currently in public beta.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier with pay-as-you-go marketplace + Pro/Elite plans",
    availability: "https://schema.org/PreOrder",
  },
  featureList: [
    "Taste-based AI clip selection",
    "Auto-captions with designer styling",
    "Brand color palettes",
    "3-sided marketplace (creators, brands, clippers)",
    "View-verification bot",
    "CPM-based clipper earnings",
    "Stripe checkout",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${geist.variable} ${geistMono.variable} ${fraunces.variable} ${bebasNeue.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-fuchsia-500 focus:text-white focus:text-sm focus:rounded-md"
        >
          Skip to main content
        </a>
        <ThemeProvider>
          <AuthProvider>
            <CustomCursor />
            <Header />
            <ValuePropBar />
            <main id="main-content" className="flex-1 relative z-[1]">{children}</main>
            <Footer />
            <CookieBanner />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(ORG_JSON_LD) }}
            />
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_JSON_LD) }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
