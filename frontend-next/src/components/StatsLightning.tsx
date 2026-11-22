"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export default function StatsLightning({ className }: { className: string }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    let disposed = false;
    let stop: (() => void) | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      void import("./statsLightningScene")
        .then(async ({ mountLightning }) => {
          await image.decode();
          if (disposed) return;
          stop = mountLightning(canvas, image);
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
        ref={imageRef}
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
