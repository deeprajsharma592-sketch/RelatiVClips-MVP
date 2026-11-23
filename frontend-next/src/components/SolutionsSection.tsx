"use client";

import { useEffect, useRef } from "react";
import { mountAudienceWeb } from "./audienceWebScene";
import styles from "./SolutionsSection.module.css";

export default function SolutionsSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const button = buttonRef.current;
    if (!canvas || !button) return;

    const scene = mountAudienceWeb(canvas, window.matchMedia("(prefers-reduced-motion: reduce)"));
    if (!scene) return;

    let hasPlayed = false;
    const play = () => {
      hasPlayed = true;
      scene.play();
    };
    const playWhenCentered = () => {
      if (hasPlayed) return;
      const bounds = button.getBoundingClientRect();
      if (Math.abs(bounds.top + bounds.height / 2 - window.innerHeight / 2) <= 36) play();
    };

    button.addEventListener("click", play);
    window.addEventListener("scroll", playWhenCentered, { passive: true });
    window.addEventListener("resize", playWhenCentered);
    playWhenCentered();

    return () => {
      button.removeEventListener("click", play);
      window.removeEventListener("scroll", playWhenCentered);
      window.removeEventListener("resize", playWhenCentered);
      scene.dispose();
    };
  }, []);

  return (
    <section className="relative h-[200svh] bg-transparent" aria-label="RelatiV audience network">
      <div className="sticky top-16 h-[calc(100svh-8rem)] overflow-hidden bg-transparent">
        <h2 className="absolute inset-x-4 top-[6%] z-10 text-center text-2xl font-bold tracking-[-0.045em] text-white sm:text-3xl md:text-4xl lg:text-5xl">
          Built for every creator, brand, and team.
        </h2>
        <div className={styles.stage}>
          <canvas ref={canvasRef} className={styles.canvas} width={1440} height={810} aria-hidden="true" />
          <button ref={buttonRef} className={styles.launch} type="button" aria-label="RelatiV, replay the audience animation">
            RelatiV<span aria-hidden="true" />
          </button>
        </div>
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
