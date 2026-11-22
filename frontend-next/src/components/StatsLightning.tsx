"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function StatsLightning({ className }: { className: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let stop: (() => void) | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      void import("./statsLightningScene")
        .then(({ mountLightning }) => {
          if (disposed) return;
          stop = mountLightning(canvas);
          setReady(Boolean(stop));
        })
        .catch(() => {
          // The still image remains visible if the scene cannot load.
        });
    });
    observer.observe(canvas);

    return () => {
      disposed = true;
      observer.disconnect();
      stop?.();
    };
  }, []);

  return (
    <span className={className} data-ready={ready} aria-hidden="true">
      <Image
        src="/stats/glass-lightning.webp"
        alt=""
        width={26}
        height={40}
        unoptimized
      />
      <canvas ref={canvasRef} />
    </span>
  );
}
