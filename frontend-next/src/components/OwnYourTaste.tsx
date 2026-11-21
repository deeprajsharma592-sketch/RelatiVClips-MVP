"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import styles from "./OwnYourTaste.module.css";

const PARTS = [
  [
    ["O", -8, 21, -0.09],
    ["w", 14, -35, 0.13],
    ["n", -26, 58, -0.19, 0.68],
  ],
  [
    ["Y", 27, -58, 0.19, 0.68],
    ["o", -17, 39, -0.14],
    ["u", 13, -32, 0.12],
    ["r", -9, 27, -0.08],
    [" "],
    ["T", 9, -25, 0.08],
    ["a", -8, 21, -0.07],
    ["s", 8, -19, 0.07],
    ["t", -6, 16, -0.05],
    ["e", 5, -12, 0.04],
  ],
] as const;

export default function OwnYourTaste() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!section || reducedMotion.matches) return;

    const initial = section.getBoundingClientRect();
    if (initial.top + initial.height / 2 <= window.innerHeight * 0.56) return;

    section.dataset.reveal = "waiting";
    let frame = 0;

    function stop() {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    }

    function checkPosition() {
      frame = 0;
      if (!section) return;
      const { top, height, bottom } = section.getBoundingClientRect();
      if (top + height / 2 > window.innerHeight * 0.56) return;

      stop();
      if (bottom > 0 && !reducedMotion.matches) {
        section.dataset.reveal = "playing";
      } else {
        delete section.dataset.reveal;
      }
    }

    function schedule() {
      if (!frame) frame = requestAnimationFrame(checkPosition);
    }

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();

    return () => {
      stop();
      delete section.dataset.reveal;
    };
  }, []);

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="own-your-taste-title">
      <h2 id="own-your-taste-title" className={styles.heading} aria-label="Own Your Taste">
        {PARTS.map((part, partIndex) => (
          <span
            key={partIndex}
            className={partIndex === 0 ? styles.left : styles.right}
            aria-hidden="true"
          >
            {part.map(([letter, bend, fold, lift, pinch], index) =>
              letter === " " ? " " : (
                <span
                  key={index}
                  className={styles.glyph}
                  data-letter={letter}
                  style={{
                    "--bend": `${bend}deg`,
                    "--fold": `${fold}deg`,
                    "--lift": `${lift}em`,
                    "--pinch": pinch ?? 0.85,
                  } as CSSProperties}
                >
                  {letter}
                </span>
              ),
            )}
          </span>
        ))}
      </h2>
    </section>
  );
}
