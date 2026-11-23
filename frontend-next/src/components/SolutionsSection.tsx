"use client";

import { useEffect, useRef } from "react";
import { mountAudienceNetwork } from "./audienceNetworkScene";

export default function SolutionsSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logoMarkerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const marker = logoMarkerRef.current;
    if (!canvas || !marker) return;

    const scene = mountAudienceNetwork(
      canvas,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    if (!scene) return;

    let hasPlayed = false;
    const playWhenLogoIsCentered = () => {
      if (hasPlayed) return;

      const markerCenter = marker.getBoundingClientRect().top + marker.offsetHeight / 2;
      const viewportCenter = window.innerHeight / 2;
      if (Math.abs(markerCenter - viewportCenter) > 36) return;

      hasPlayed = true;
      scene.play();
    };

    window.addEventListener("scroll", playWhenLogoIsCentered, { passive: true });
    window.addEventListener("resize", playWhenLogoIsCentered);
    playWhenLogoIsCentered();

    return () => {
      window.removeEventListener("scroll", playWhenLogoIsCentered);
      window.removeEventListener("resize", playWhenLogoIsCentered);
      scene.dispose();
    };
  }, []);

  return (
    <section className="relative h-[200svh] bg-transparent" aria-label="RelatiV audience network">
      <div className="sticky top-16 h-[calc(100svh-8rem)] overflow-hidden bg-transparent">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        <h2 className="absolute inset-x-4 top-[6%] z-10 text-center text-2xl font-bold tracking-[-0.045em] text-white sm:text-3xl md:text-4xl lg:text-5xl">
          Built for every creator, brand, and team.
        </h2>
        <span
          ref={logoMarkerRef}
          className="pointer-events-none absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
        <ul className="sr-only" aria-label="Audiences">
          <li>Agencies</li>
          <li>Teams</li>
          <li>Developers</li>
          <li>Creators</li>
          <li>Brands</li>
          <li>Entrepreneurs</li>
          <li>E-commerce</li>
          <li>SaaS</li>
        </ul>
      </div>
    </section>
  );
}
