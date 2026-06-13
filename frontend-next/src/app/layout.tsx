import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono, Instrument_Serif } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
import ScrollProgress from "@/components/ScrollProgress";
import CustomCursor from "@/components/CustomCursor";
import { AuthProvider } from "@/lib/AuthContext";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  weight: "400",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "RelatiV — Viral clips, picked by AI, finished in minutes",
  description:
    "Paste a YouTube link. Get 10 ready-to-post clips in 5 minutes. Taste-based selection, designer captions, your brand colors. Built for podcasters, brands, and creators who ship.",
  metadataBase: new URL("https://relativclips.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    locale: "en_US",
    url: "https://relativclips.com",
    siteName: "RelatiV",
    title: "RelatiV — Turn one video into ten viral clips in 60 seconds",
    description:
      "Paste a YouTube link. Get 10 ready-to-post clips in 5 minutes. Taste-based AI selection, designer captions, your brand colors. Built for podcasters, brands, and creators who ship.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "RelatiV — viral clip engine. Turn one video into ten viral clips in 60 seconds.",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "RelatiV — Turn one video into ten viral clips in 60 seconds",
    description:
      "Paste a YouTube link. Get 10 ready-to-post clips in 5 minutes. Taste-based AI selection, designer captions, your brand colors.",
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
  authors: [{ name: "RelatiV Labs" }],
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
  legalName: "RelatiV Labs",
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
  operatingSystem: "Web",
  url: "https://relativclips.com",
  description:
    "Paste a YouTube link. Get 10 ready-to-post short-form clips in 5 minutes. Taste-based AI selection, designer captions, your brand colors. 3-sided marketplace for creators, brands, and clippers.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free tier with pay-as-you-go marketplace + Pro/Elite plans",
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
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-fuchsia-500 focus:text-white focus:text-sm focus:rounded-md"
        >
          Skip to main content
        </a>
        <AuthProvider>
          <CustomCursor />
          <ScrollProgress />
          <Header />
          <main id="main-content" className="flex-1">{children}</main>
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
      </body>
    </html>
  );
}
