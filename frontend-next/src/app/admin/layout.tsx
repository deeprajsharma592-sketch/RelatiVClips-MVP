import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RelatiV Control Room",
  description: "Private RelatiV platform operations dashboard.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
