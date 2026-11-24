"use client";

import { useEffect, useRef } from "react";
import { mountFloatingAirship } from "./floatingAirshipScene";
import { usePathname } from "next/navigation";
import styles from "./FloatingAirship.module.css";

export default function FloatingAirship({ homepage = false }: { homepage?: boolean }) {
  const pathname = usePathname();
  if (!pathname || (pathname === "/") !== homepage) return null;
  const segments = pathname?.split("/") ?? [];
  if (segments.includes("dashboard") || segments[1] === "onboarding") return null;

  return <AirshipCanvas homepage={homepage} />;
}

function AirshipCanvas({ homepage }: { homepage: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let stop: (() => void) | undefined;
    const sync = () => {
      stop?.();
      stop = !motion.matches && canvas.current ? mountFloatingAirship(canvas.current) : undefined;
    };
    sync();
    motion.addEventListener("change", sync);
    return () => {
      stop?.();
      motion.removeEventListener("change", sync);
    };
  }, []);

  return (
    <canvas
      ref={canvas}
      className={homepage ? `${styles.flight} ${styles.homepageFlight}` : styles.flight}
      role="img"
      aria-label="Own Your Taste"
    />
  );
}
