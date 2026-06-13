"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";

/**
 * ThemeProvider — wraps the app with next-themes for 3-way theme support.
 *  - `defaultTheme="system"` → respects user's OS-level preference (prefers-color-scheme)
 *  - `enableSystem` → re-renders when OS theme changes
 *  - `attribute="class"` → toggles .dark on <html>, so .dark { } selectors in CSS flip
 *  - `themes={["light", "dark", "system"]}` → 3-way cycle for the toggle
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="relativ-theme"
      themes={["light", "dark", "system"]}
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
