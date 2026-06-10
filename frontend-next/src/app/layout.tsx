import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import CookieBanner from "@/components/CookieBanner";
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

export const metadata: Metadata = {
  title: "RelatiV - AI-Powered Video Clipping",
  description:
    "Quantum-precision video clipping engine. Privacy-first, locally processed AI extraction.",
  keywords: ["video clipping", "AI", "YouTube", "content creation", "privacy"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#000000] text-[#FFFFFF]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:text-sm focus:rounded-[4px]"
        >
          Skip to main content
        </a>
        <Header />
        <main id="main-content" className="flex-1">{children}</main>
        <Footer />
        <CookieBanner />
      </body>
    </html>
  );
}
