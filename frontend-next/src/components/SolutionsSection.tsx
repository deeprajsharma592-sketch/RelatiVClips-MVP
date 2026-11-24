"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
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
    const threshold = 0.35;
    const observer = new IntersectionObserver(([entry]) => {
      scene.setVisible(entry.isIntersecting);
      if (!hasPlayed && entry.intersectionRatio >= threshold) play();
    }, { threshold: [0, threshold] });

    button.addEventListener("click", play);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
      button.removeEventListener("click", play);
      scene.dispose();
    };
  }, []);

  return (
    <section className="relative overflow-hidden bg-transparent px-4 py-8 sm:py-12" aria-label="RelatiV audience network">
      <h2 className="relative z-10 mx-auto max-w-screen-xl text-center text-2xl font-bold tracking-[-0.045em] text-white sm:text-3xl md:text-4xl lg:text-5xl">
        Built for every creator, brand, and team.
      </h2>
      <div className={styles.stage}>
        <canvas ref={canvasRef} className={styles.canvas} width={1440} height={810} aria-hidden="true" />
        <Image
          src="/audience-web-hero.png"
          alt=""
          width={720}
          height={658}
          unoptimized
          className={styles.webHero}
        />
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
    </section>
  );
}
