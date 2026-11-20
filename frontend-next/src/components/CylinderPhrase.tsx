"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type CylinderPhraseProps = {
  phrases: string[];
  interval?: number;
};

/** Rotates the hero copy through a restrained, perspective text cylinder. */
export default function CylinderPhrase({
  phrases,
  interval = 3000,
}: CylinderPhraseProps) {
  const [index, setIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const faceAngle = 360 / phrases.length;
  const cylinderRadiusEm = 0.69 / Math.tan(Math.PI / phrases.length);

  useEffect(() => {
    if (prefersReducedMotion || phrases.length < 2) return;

    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % phrases.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [interval, phrases.length, prefersReducedMotion]);

  return (
    <span
      className="relative block h-[1.38em] w-full overflow-hidden [perspective:900px]"
      aria-label={phrases[index]}
    >
      <span className="sr-only" aria-live="polite">
        {phrases[index]}
      </span>
      <motion.span
        aria-hidden="true"
        className="absolute inset-0 block [transform-style:preserve-3d]"
        animate={{ rotateX: prefersReducedMotion ? 0 : -index * faceAngle }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      >
        {phrases.map((phrase, faceIndex) => (
          <span
            key={phrase}
            className="absolute inset-0 flex items-center justify-center whitespace-nowrap [backface-visibility:hidden]"
            style={{
              transform: `rotateX(${faceIndex * faceAngle}deg) translateZ(${cylinderRadiusEm}em)`,
            }}
          >
            {phrase}
          </span>
        ))}
      </motion.span>
    </span>
  );
}
