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
    type: "website",
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
  keywords: ["relativ", "video clipping", "AI clips", "creator economy", "podcast clips", "YouTube clips", "short form", "viral", "AI", "Whisper", "Claude"],
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
        </AuthProvider>
      </body>
    </html>
  );
}
