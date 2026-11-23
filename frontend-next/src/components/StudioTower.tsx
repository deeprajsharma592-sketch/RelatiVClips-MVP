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
    <section aria-label="Interactive studio tower" className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 sm:py-12">
      <div ref={root} className="group relative h-[clamp(440px,77svh,840px)] lg:h-[clamp(485px,85svh,925px)]">
        <Image
          src="/studio-tower/hover-transparent.png"
          alt="Metallic studio tower hovering above a blue exhaust plume"
          fill
          unoptimized
          className="object-contain sm:scale-[1.14] group-data-[live=true]:hidden"
        />
        <canvas
          role="img"
          aria-label="Interactive 3D model of the hovering studio tower"
          className="invisible block h-full w-full touch-pan-y cursor-grab active:cursor-grabbing group-data-[live=true]:visible"
        />
        <span role="status" className="sr-only">Loading interactive model</span>
      </div>
    </section>
  );
}
