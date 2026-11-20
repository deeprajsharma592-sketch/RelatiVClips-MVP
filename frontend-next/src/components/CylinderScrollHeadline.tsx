"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";

const CHAPTERS = [
  "Turn any footage into",
  "Personalized short clips",
  "More views, less editing",
  "Your style on every platform",
  "Make every moment count",
];
const GAP = 72;

type CylinderScrollHeadlineProps = { children?: ReactNode };

function CylinderWord({ index, progress, radius }: {
  index: number;
  progress: ReturnType<typeof useSpring>;
  radius: string;
}) {
  const center = index / (CHAPTERS.length - 1);
  const input = index === 0
    ? [0, 0.12, 0.28]
    : index === CHAPTERS.length - 1
      ? [0.72, 0.88, 1]
      : [center - 0.16, center, center + 0.16];
  const output = index === 0 ? [1, 1, 0] : index === CHAPTERS.length - 1 ? [0, 1, 1] : [0, 1, 0];
  const opacity = useTransform(progress, input, output);
  const rotation = index * GAP;

  return (
    <motion.span
      aria-hidden="true"
      className="absolute inset-0 grid place-items-center whitespace-nowrap text-center text-[min(6vw,6rem)] [backface-visibility:hidden]"
      style={{
        transform: `rotateX(${rotation}deg) translateZ(${radius})`,
        opacity,
      }}
    >
      {CHAPTERS[index]}
    </motion.span>
  );
}

export default function CylinderScrollHeadline({ children }: CylinderScrollHeadlineProps) {
  const trackRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 70, damping: 24, mass: 0.4 });
  const rotation = useTransform(progress, [0, 1], [0, -(CHAPTERS.length - 1) * GAP]);
  const barHeight = useTransform(progress, [0, 1], ["0%", "100%"]);
  const chapterNumber = useTransform(progress, (value) => {
    const current = Math.min(CHAPTERS.length, Math.floor(value * CHAPTERS.length) + 1);
    return `${String(current).padStart(2, "0")} / ${String(CHAPTERS.length).padStart(2, "0")}`;
  });

  return (
    <section
      ref={trackRef}
      id="cylinder-scroll-story"
      className="relative bg-[#050507] text-white"
      style={{ minHeight: reduceMotion ? "min(720px, 100svh)" : "560svh" }}
      aria-label="Scroll through the RelatiV story"
    >
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] min-h-[560px] items-center justify-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,38,52,0.2),transparent_58%)]" />

        <div className="absolute left-5 top-5 z-10 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 sm:left-8 sm:top-7">
          <span className="text-white">RelatiV</span> <span className="mx-2 text-zinc-700">/</span> Made to move
        </div>
        <div className="absolute right-5 top-5 z-10 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500 sm:right-8 sm:top-7">
          Scroll to explore
        </div>

        <div className="relative z-[1] flex w-full flex-col items-center px-5 text-center">
          <h1 className="sr-only">Turn any footage into personalized short clips, faster</h1>
          <div className="relative flex h-[clamp(5rem,15vw,11rem)] w-full max-w-[1500px] items-center justify-center [perspective:1000px]">
            <motion.div
              className="relative h-full w-full [transform-style:preserve-3d]"
              style={{ rotateX: reduceMotion ? 0 : rotation }}
            >
              {CHAPTERS.map((chapter, index) => (
                reduceMotion && index > 0 ? null : (
                <CylinderWord key={chapter} index={index} progress={progress} radius="clamp(130px, 12vw, 210px)" />
                )
              ))}
            </motion.div>
          </div>

          <p className="mt-2 text-[clamp(1.5rem,4.7vw,4.6rem)] font-display font-extrabold leading-none tracking-[-0.045em] text-white">
            20× faster
          </p>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base lg:text-lg">
            Paste a link or drop a raw take. RelatiV finds the moments, edits the clips, and sizes them for every platform.
          </p>
          {children}
        </div>

        <div className="absolute bottom-5 left-5 z-10 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500 sm:bottom-7 sm:left-8">
          <motion.span>{chapterNumber}</motion.span>
          <span className="h-px w-10 bg-zinc-800 sm:w-16"><motion.i className="block h-px bg-fuchsia-400" style={{ scaleX: barHeight, transformOrigin: "left" }} /></span>
          <span>Scroll story</span>
        </div>
        <div className="absolute bottom-0 right-0 top-0 w-px bg-white/[0.08]">
          <motion.i className="block w-px bg-gradient-to-b from-orange-400 to-fuchsia-500" style={{ height: barHeight }} />
        </div>

        {!reduceMotion && <div className="absolute bottom-5 right-5 z-10 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-600 sm:bottom-7 sm:right-8">Keep scrolling ↓</div>}
      </div>
    </section>
  );
}
