"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

export default function StudioTower() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const controller = new AbortController();
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      void import("./studioTowerRenderer")
        .then(({ mountStudioTower }) => mountStudioTower(element, controller.signal))
        .catch(() => {});
    }, { rootMargin: "200px" });
    observer.observe(element);

    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, []);

  return (
    <section aria-label="Interactive studio tower" className="mx-auto w-full max-w-[1440px] px-4 py-12 sm:px-6 sm:py-20">
      <div ref={root} className="group flex h-[clamp(420px,70svh,760px)] flex-col overflow-hidden rounded-3xl bg-[#08090f]">
        <div className="relative min-h-0 flex-1">
          <Image
            src="/studio-tower/poster.png"
            alt="Metallic studio tower hovering above a blue exhaust plume"
            fill
            unoptimized
            className="object-contain group-data-[live=true]:hidden"
          />
          <canvas
            role="img"
            aria-label="Interactive 3D model of the hovering studio tower"
            className="invisible block h-full w-full touch-none cursor-grab bg-[radial-gradient(ellipse_at_center,#272831,#08090f_72%)] active:cursor-grabbing group-data-[live=true]:visible"
          />
        </div>
        <div className="hidden min-h-14 flex-wrap items-center justify-center gap-3 px-3 py-2 group-data-[live=true]:flex">
          <button type="button" data-spin aria-pressed="false" disabled className="rounded-full border border-white/20 px-3 py-1.5 text-sm aria-pressed:bg-white aria-pressed:text-black">
            Auto-rotate
          </button>
          <label className="flex items-center gap-2 text-sm">
            Angle
            <input type="range" min="0" max="360" defaultValue="0" disabled className="w-24 accent-white sm:w-40" />
          </label>
        </div>
        <span role="status" className="sr-only">Loading interactive model</span>
      </div>
    </section>
  );
}
