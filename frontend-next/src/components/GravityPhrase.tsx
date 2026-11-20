"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

type GravityPhraseProps = {
  phrases: string[];
  interval?: number;
};

const phraseVariants = {
  initial: {},
  enter: {
    transition: { staggerChildren: 0.018, delayChildren: 0.025 },
  },
  exit: {
    transition: { staggerChildren: 0.012, staggerDirection: -1 },
  },
};

const letterVariants = {
  initial: {
    y: -24,
    opacity: 0,
    rotateX: -55,
    filter: "blur(7px)",
  },
  enter: {
    y: 0,
    opacity: 1,
    rotateX: 0,
    filter: "blur(0px)",
    transition: { type: "spring" as const, stiffness: 210, damping: 20 },
  },
  exit: (letterIndex: number) => ({
    y: 38 + (letterIndex % 4) * 12,
    x: letterIndex % 2 === 0 ? -10 : 10,
    opacity: 0,
    rotateZ: letterIndex % 2 === 0 ? -18 : 18,
    filter: "blur(6px)",
    transition: {
      duration: 0.44,
      ease: [0.22, 0.68, 0, 1] as [number, number, number, number],
    },
  }),
};

/** Letters settle into a headline, then fall away as the phrase changes. */
export default function GravityPhrase({
  phrases,
  interval = 3800,
}: GravityPhraseProps) {
  const [index, setIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const phrase = phrases[index] ?? "";

  useEffect(() => {
    if (prefersReducedMotion || phrases.length < 2) return;

    const timer = window.setInterval(() => {
      if (!document.hidden) setIndex((current) => (current + 1) % phrases.length);
    }, interval);

    return () => window.clearInterval(timer);
  }, [interval, phrases.length, prefersReducedMotion]);

  return (
    <motion.span
      layout
      transition={{ layout: { type: "spring", stiffness: 150, damping: 24 } }}
      className="relative inline-flex h-[1.38em] items-center justify-center overflow-visible"
    >
      <span aria-hidden="true" className="invisible whitespace-nowrap">
        {phrase}
      </span>
      <span className="sr-only" aria-live="polite">
        {phrase}
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={phrase}
          aria-hidden="true"
          variants={phraseVariants}
          initial={prefersReducedMotion ? false : "initial"}
          animate="enter"
          exit={prefersReducedMotion ? undefined : "exit"}
          className="absolute inset-0 flex items-center justify-center whitespace-nowrap"
        >
          {Array.from(phrase).map((character, characterIndex) => (
            <motion.span
              key={`${character}-${characterIndex}`}
              custom={characterIndex}
              variants={letterVariants}
              className="inline-block will-change-transform"
            >
              {character === " " ? "\u00a0" : character}
            </motion.span>
          ))}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}
