"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function SiteChrome({ placement }: { placement: "header" | "footer" }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return placement === "header" ? <Header /> : <Footer />;
}
