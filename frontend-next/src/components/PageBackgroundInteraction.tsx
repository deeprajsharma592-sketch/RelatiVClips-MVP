"use client";

import { useEffect } from "react";

export default function PageBackgroundInteraction() {
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const root = document.documentElement;
    let frame = 0;

    const trackPointer = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;

      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        root.style.setProperty("--page-cursor-x", `${event.clientX}px`);
        root.style.setProperty("--page-cursor-y", `${event.clientY}px`);
        root.style.setProperty("--page-cursor-glow", "1");
      });
    };

    const hideGlow = () => root.style.setProperty("--page-cursor-glow", "0");

    window.addEventListener("pointermove", trackPointer, { passive: true });
    window.addEventListener("blur", hideGlow);

    return () => {
      window.removeEventListener("pointermove", trackPointer);
      window.removeEventListener("blur", hideGlow);
      cancelAnimationFrame(frame);
      root.style.removeProperty("--page-cursor-x");
      root.style.removeProperty("--page-cursor-y");
      root.style.removeProperty("--page-cursor-glow");
    };
  }, []);

  return null;
}
