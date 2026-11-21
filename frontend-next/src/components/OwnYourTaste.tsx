"use client";

import { useEffect, useRef } from "react";
import styles from "./OwnYourTaste.module.css";

const DURATION = 1100;
const IMPACT = 0.55;
const IMPACT_DELAY = DURATION * IMPACT;
const SWING_EASING = "cubic-bezier(.55,0,.9,.6)";
const RISE_EASING = "cubic-bezier(.2,.8,.3,1)";
const PLAYED_KEY = "relativ-own-your-taste-animation-played";

function sideKeyframes(direction: -1 | 1): Keyframe[] {
  return [
    {
      transform: `translateX(${direction * 120}vw) skewX(${direction * -24}deg)`,
      opacity: 0,
      offset: 0,
      easing: SWING_EASING,
    },
    { transform: "translateX(0) skewX(0)", opacity: 1, offset: IMPACT },
    { transform: `scale(0.78, 1.14) skewX(${direction * 5}deg)`, offset: 0.70 },
    { transform: "scale(1.06, 0.97)", offset: 0.78 },
    { transform: "scale(1, 1)", offset: 1 },
  ];
}

export default function OwnYourTaste() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const floorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const title = titleRef.current;
    const floor = floorRef.current;
    if (!section || !title || !floor) return;

    const left = title.querySelector<HTMLElement>('[data-word="left"]');
    const middle = title.querySelector<HTMLElement>('[data-word="middle"]');
    const right = title.querySelector<HTMLElement>('[data-word="right"]');
    if (!left || !middle || !right) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const wordTiming = { duration: DURATION, fill: "backwards" } as const;
    let running: Animation[] = [];
    let hasPlayed = false;
    try {
      hasPlayed = window.sessionStorage.getItem(PLAYED_KEY) === "true";
    } catch {
      // Keep the animation usable if browser storage is unavailable.
    }

    function stop() {
      running.forEach((animation) => animation.cancel());
      running = [];
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      if (!entry.isIntersecting || hasPlayed) return;

      hasPlayed = true;
      try {
        window.sessionStorage.setItem(PLAYED_KEY, "true");
      } catch {
        // The in-memory guard still prevents repeat triggers until unmount.
      }
      observer.unobserve(section);
      if (reducedMotion.matches) return;

      running = [
        left.animate(sideKeyframes(-1), wordTiming),
        right.animate(sideKeyframes(1), wordTiming),
        middle.animate([
          { transform: "translateY(140px) scale(0.5)", opacity: 0, offset: 0, easing: RISE_EASING },
          { transform: "translateY(0) scale(1)", opacity: 1, offset: 0.5 },
          { transform: "scale(1, 1)", offset: IMPACT },
          { transform: "scale(0.82, 1.16)", offset: 0.70 },
          { transform: "scale(1.05, 0.96)", offset: 0.78 },
          { transform: "scale(1, 1)", offset: 1 },
        ], wordTiming),
        floor.animate([
          { transform: "scaleX(0)", opacity: 0 },
          { transform: "scaleX(1)", opacity: 1 },
        ], { duration: 500, delay: IMPACT_DELAY, easing: RISE_EASING, fill: "both" }),
        title.animate([
          { filter: "brightness(1)" },
          { filter: "brightness(1.7)" },
          { filter: "brightness(1)" },
        ], { duration: 260, delay: IMPACT_DELAY }),
      ];
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });

    observer.observe(section);
    reducedMotion.addEventListener("change", stop);

    return () => {
      observer.disconnect();
      reducedMotion.removeEventListener("change", stop);
      stop();
    };
  }, []);

  return (
    <section ref={sectionRef} className={styles.stage} aria-labelledby="own-your-taste-title">
      <h2 ref={titleRef} id="own-your-taste-title" className={styles.title}>
        <span className={styles.word} data-word="left" data-text="Own">Own</span>{" "}
        <span className={styles.word} data-word="middle" data-text="Your">Your</span>{" "}
        <span className={styles.word} data-word="right" data-text="Taste">Taste</span>
      </h2>
      <div ref={floorRef} className={styles.floor} aria-hidden="true" />
    </section>
  );
}
