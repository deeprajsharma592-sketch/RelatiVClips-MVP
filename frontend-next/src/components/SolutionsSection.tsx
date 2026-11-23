"use client";

import { useEffect, useRef } from "react";

export default function SolutionsSection() {
  const logoMarkerRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    const marker = logoMarkerRef.current;
    const video = videoRef.current;
    if (!marker || !video) return;

    const playWhenLogoIsCentered = () => {
      if (hasPlayedRef.current) return;

      const markerCenter = marker.getBoundingClientRect().top + marker.offsetHeight / 2;
      const viewportCenter = window.innerHeight / 2;
      if (Math.abs(markerCenter - viewportCenter) > 36) return;

      hasPlayedRef.current = true;
      void video.play().catch(() => {
        hasPlayedRef.current = false;
      });
    };

    window.addEventListener("scroll", playWhenLogoIsCentered, { passive: true });
    window.addEventListener("resize", playWhenLogoIsCentered);
    playWhenLogoIsCentered();

    return () => {
      window.removeEventListener("scroll", playWhenLogoIsCentered);
      window.removeEventListener("resize", playWhenLogoIsCentered);
    };
  }, []);

  return (
    <section
      className="relative h-[200svh] bg-black"
      aria-label="RelatiV audience network"
    >
      <div className="sticky top-16 h-[calc(100svh-8rem)] overflow-hidden bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full -translate-y-6 object-contain"
          src="/videos/audience-network.mp4"
          width="1280"
          height="720"
          muted
          playsInline
          preload="metadata"
          aria-label="RelatiV audience network animation"
        />
        <span
          ref={logoMarkerRef}
          className="pointer-events-none absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
