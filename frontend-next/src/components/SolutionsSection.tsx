"use client";

import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import {
  Cloud,
  Code2,
  Layers3,
  Play,
  Rocket,
  ShoppingCart,
  Tag,
  Users,
} from "lucide-react";

const AUDIENCES = [
  { label: "Agencies", Icon: Layers3, x: 50, y: 35, edge: [50, 40], mobileEdge: [50, 31], reveal: [0.02, 0.3] },
  { label: "Teams", Icon: Users, x: 22, y: 44, edge: [31, 45], mobileEdge: [37, 39], reveal: [0.08, 0.36] },
  { label: "Developers", Icon: Code2, x: 78, y: 44, edge: [69, 45], mobileEdge: [63, 39], reveal: [0.08, 0.36] },
  { label: "Creators", Icon: Play, x: 15, y: 60, edge: [24, 60], mobileEdge: [37, 52], reveal: [0.2, 0.48] },
  { label: "Brands", Icon: Tag, x: 85, y: 60, edge: [76, 60], mobileEdge: [63, 52], reveal: [0.2, 0.48] },
  { label: "Entrepreneurs", Icon: Rocket, x: 24, y: 76, edge: [33, 75], mobileEdge: [38, 65], reveal: [0.34, 0.62] },
  { label: "E-commerce", Icon: ShoppingCart, x: 76, y: 76, edge: [67, 75], mobileEdge: [62, 65], reveal: [0.34, 0.62] },
  { label: "SaaS", Icon: Cloud, x: 50, y: 82, edge: [50, 78], mobileEdge: [50, 75], reveal: [0.48, 0.76] },
] as const;

type Audience = (typeof AUDIENCES)[number];

function NetworkConnection({
  audience,
  progress,
  reduceMotion,
}: {
  audience: Audience;
  progress: MotionValue<number>;
  reduceMotion: boolean;
}) {
  const draw = useTransform(progress, audience.reveal, [0, 1], { clamp: true });
  const [edgeX, edgeY] = audience.edge;
  const [mobileEdgeX, mobileEdgeY] = audience.mobileEdge;

  return (
    <>
      {[{ edgeX, edgeY, className: "solutions-desktop-wire" }, { edgeX: mobileEdgeX, edgeY: mobileEdgeY, className: "solutions-mobile-wire" }].map((wire) => (
        <motion.g key={wire.className} className={wire.className}>
          <motion.path
            d={`M 500 365 L ${wire.edgeX * 10} ${wire.edgeY * 6.4}`}
            fill="none"
            stroke="rgba(244,244,248,.82)"
            strokeWidth="1.15"
            strokeLinecap="round"
            style={{ pathLength: reduceMotion ? 1 : draw, opacity: reduceMotion ? 0.72 : draw }}
          />
          <motion.circle
            cx={wire.edgeX * 10}
            cy={wire.edgeY * 6.4}
            r="2"
            fill="rgba(244,244,248,.9)"
            style={{ opacity: reduceMotion ? 0.82 : draw }}
          />
        </motion.g>
      ))}
    </>
  );
}

function NetworkCard({
  audience,
}: {
  audience: Audience;
}) {
  const { Icon } = audience;

  return (
    <motion.div
      data-audience={audience.label}
      className="solutions-network-card absolute z-10 flex min-h-[58px] min-w-[178px] -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-xl border border-white/80 bg-[#050506]/95 px-4 py-3 text-[15px] font-semibold text-white shadow-[0_0_24px_rgba(255,255,255,0.035)] sm:min-w-[190px] sm:text-base"
      style={{ left: `${audience.x}%`, top: `${audience.y}%`, opacity: 1, scale: 1 }}
    >
      <Icon className="size-6 shrink-0 text-white" strokeWidth={2} aria-hidden="true" />
      <span>{audience.label}</span>
    </motion.div>
  );
}

export default function SolutionsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const logoScale = useTransform(scrollYProgress, [0, 0.18], [0.82, 1], { clamp: true });
  const logoOpacity = useTransform(scrollYProgress, [0, 0.12], [0.45, 1], { clamp: true });

  return (
    <section ref={sectionRef} className="relative h-[230svh] bg-black text-white" aria-label="Who RelatiV is for">
      <div className="sticky top-16 flex h-[calc(100svh-4rem)] min-h-[600px] items-center overflow-hidden bg-black">
        <div className="relative mx-auto h-full w-full max-w-[1600px] px-4 sm:px-8">
          <div className="absolute inset-x-5 top-[7%] z-10 text-center sm:top-[8%]">
            <h2 className="mx-auto max-w-none whitespace-nowrap text-2xl font-display font-bold tracking-[-0.045em] text-white sm:text-3xl md:text-4xl lg:text-[clamp(2.5rem,4vw,3.5rem)]">
              Built for every creator, brand, and team.
            </h2>
          </div>

          <svg
            className="solutions-network-svg pointer-events-none absolute inset-0 z-0 h-full w-full"
            viewBox="0 0 1000 640"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {AUDIENCES.map((audience) => (
              <NetworkConnection
                key={audience.label}
                audience={audience}
                progress={scrollYProgress}
                reduceMotion={!!reduceMotion}
              />
            ))}
          </svg>

          <div className="pointer-events-none absolute inset-0">
            {AUDIENCES.map((audience) => (
              <NetworkCard
                key={audience.label}
                audience={audience}
              />
            ))}
          </div>

          <motion.div
            className="absolute left-1/2 top-[57%] z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-black px-3 py-1 text-3xl font-bold tracking-[-0.06em] text-white sm:text-4xl md:text-5xl"
            style={{ scale: reduceMotion ? 1 : logoScale, opacity: reduceMotion ? 1 : logoOpacity }}
            aria-label="RelatiV"
          >
            <span>RelatiV</span>
            <span className="text-[#ff2c87]" aria-hidden="true">▶</span>
          </motion.div>
        </div>
        <div className="pointer-events-none absolute bottom-7 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
          Scroll to connect
        </div>
      </div>
      <style jsx>{`
        @media (max-width: 640px) {
          .solutions-desktop-wire { display: none; }
          .solutions-mobile-wire { display: block; }
          .solutions-mobile-wire path { stroke-width: 1.4px; }
          .solutions-network-card { min-width: 128px; min-height: 44px; gap: 7px; padding: 7px 9px; border-radius: 10px; font-size: 11px; }
          .solutions-network-card :global(svg) { width: 17px; height: 17px; }
          .solutions-network-card[data-audience="Agencies"] { left: 50% !important; top: 25% !important; }
          .solutions-network-card[data-audience="Teams"] { left: 26% !important; top: 38% !important; }
          .solutions-network-card[data-audience="Developers"] { left: 74% !important; top: 38% !important; }
          .solutions-network-card[data-audience="Creators"] { left: 26% !important; top: 51% !important; }
          .solutions-network-card[data-audience="Brands"] { left: 74% !important; top: 51% !important; }
          .solutions-network-card[data-audience="Entrepreneurs"] { left: 27% !important; top: 65% !important; }
          .solutions-network-card[data-audience="E-commerce"] { left: 73% !important; top: 65% !important; }
          .solutions-network-card[data-audience="SaaS"] { left: 50% !important; top: 78% !important; }
          h2 { white-space: normal; }
        }
        @media (min-width: 641px) {
          .solutions-mobile-wire { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .solutions-network-card { transition: none !important; }
        }
      `}</style>
    </section>
  );
}
