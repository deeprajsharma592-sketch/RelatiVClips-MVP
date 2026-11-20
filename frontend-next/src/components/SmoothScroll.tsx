"use client";

import type { ReactNode } from "react";

/**
 * Native Scroll Provider (Zero-overhead passthrough)
 * Restores 100% native browser scrolling across desktop, trackpad, and mobile.
 * Removes all artificial scroll resistance, delays, damping, and wheel interception.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
