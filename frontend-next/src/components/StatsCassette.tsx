"use client";

import { useEffect, useRef, useState } from "react";

export default function StatsCassette({ className }: { className: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;

    let dispose: (() => void) | undefined;
    let cancelled = false;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      void import("./statsCassetteScene")
        .then(({ mountCassette }) => {
          if (cancelled) return;
          dispose = mountCassette(element);
          setReady(Boolean(dispose));
        })
        .catch(() => {
          // Keep the static cassette icon if WebGL or the scene is unavailable.
        });
    });

    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
      dispose?.();
    };
  }, []);

  return (
    <div className={className} data-ready={ready} aria-hidden="true">
      <span>📼</span>
      <canvas ref={canvas} />
    </div>
  );
}
