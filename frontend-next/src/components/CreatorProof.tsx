"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { Sparkles } from "lucide-react";
import styles from "./CreatorProof.module.css";

const REACH = "M20 148 C57 112 103 65 124 49 C146 33 174 73 209 91 C241 108 271 83 293 56 C321 22 353 21 385 28 C428 36 453 39 474 22 C503 3 546 -5 580 -15";
const PICKED_CLIPS = new Set([1, 6, 10, 15, 19, 24, 28, 33, 38, 44]);
const EXPORT_BARS = [18, 18, 18, 70, 110, 52, 16, 40, 18, 18, 18, 18];
const VIEW_BARS = [0.25, 0.32, 0.3, 0.45, 0.4, 0.55, 0.62, 0.58, 0.75, 0.82, 0.9, 1];

function ResultsCard({
  label, note, value, prefix = "", suffix, decimals = 0, className, children, indicator, motionStyle,
}: {
  label: string;
  note: string;
  value: number;
  prefix?: string;
  suffix: string;
  decimals?: number;
  className: string;
  children: ReactNode;
  indicator?: boolean;
  motionStyle?: { opacity?: MotionValue<number>; x?: MotionValue<string>; y?: MotionValue<number>; scale?: MotionValue<number> };
}) {
  const ref = useRef<HTMLElement>(null);
  const visible = useInView(ref, { once: true, amount: 0.25 });
  const reduced = useReducedMotion();
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    if (!visible || reduced) return;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 1800);
      setDisplayValue(value * (1 - (1 - progress) ** 3));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, reduced, value]);

  function moveSpotlight(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") return;
    const { currentTarget, clientX, clientY } = event;
    const bounds = currentTarget.getBoundingClientRect();
    currentTarget.style.setProperty("--mx", `${clientX - bounds.left}px`);
    currentTarget.style.setProperty("--my", `${clientY - bounds.top}px`);
  }

  return (
    <motion.article style={motionStyle} ref={ref} className={`${styles.card} ${className}`} data-visible={visible} onPointerMove={moveSpotlight}>
      <div>
        <h3 className={styles.label}>{indicator && <span className={styles.dot} aria-hidden="true" />}{label}</h3>
        <p className={styles.metric}>
          <span className="sr-only">{prefix}{value.toFixed(decimals)}{suffix}</span>
          <span aria-hidden="true">{prefix}{(reduced ? value : displayValue).toFixed(decimals)}{suffix}</span>
        </p>
        <p className={styles.note}>{note}</p>
      </div>
      {children}
    </motion.article>
  );
}

function useCardEntrance(progress: MotionValue<number>, start: number) {
  const opacity = useTransform(progress, [start, start + 0.16], [0, 1]);
  const y = useTransform(progress, [start, start + 0.16], [42, 0]);
  const scale = useTransform(progress, [start, start + 0.16], [0.94, 1]);
  return { opacity, y, scale };
}

export default function CreatorProof() {
  const gradient = useId();
  const track = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  const progress = useTransform(() => scrollYProgress.get());
  const reachX = useTransform(progress, [0.54, 0.86], ["36%", "0%"]);
  const reachY = useTransform(progress, [0.54, 0.86], [90, 0]);
  const reachScale = useTransform(progress, [0.54, 0.86], [1.43, 1]);
  const views = useCardEntrance(progress, 0.58);
  const turnaround = useCardEntrance(progress, 0.63);
  const accuracy = useCardEntrance(progress, 0.68);
  const picked = useCardEntrance(progress, 0.72);
  const exported = useCardEntrance(progress, 0.76);
  const free = useCardEntrance(progress, 0.80);
  const chartLength = useTransform(progress, [0.22, 0.52], [0, 1]);

  return (
    <section className={styles.section} aria-labelledby="creator-results-title" data-creator-results>
      <div className={styles.content}>
        <h2 id="creator-results-title" className={styles.title}>Built for creators who want to <em>grow faster.</em></h2>
        <p className={styles.sub}>See how top short-form clippers use RelatiV to dominate the feed.</p>

        <div className={styles.scrollTrack} ref={track}>
          <div className={styles.stickyStage}>
            <div className={styles.bento}>
              <ResultsCard className={styles.reach} label="Average reach increase" note="For long-form creators, first 12 weeks" value={266} prefix="+" suffix="%" indicator motionStyle={{ x: reachX, y: reachY, scale: reachScale }}>
                <svg className={styles.chart} viewBox="0 -26 600 212" role="img" aria-label="Illustrative reach trend over 12 weeks">
                  <defs>
                    <linearGradient id={gradient} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop stopColor="#19e08f" stopOpacity=".35" />
                      <stop offset="100%" stopColor="#19e08f" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <g className={styles.gridLines}>
                    {[31, 74, 117, 160].map((y) => <line key={y} x1="20" x2="580" y1={y} y2={y} />)}
                  </g>
                  <path className={styles.area} d={`${REACH} L580 160 L20 160 Z`} fill={`url(#${gradient})`} />
                  <path className={styles.lineStatic} d={REACH} />
                  <motion.path className={styles.growthLine} d={REACH} style={{ pathLength: chartLength }} />
                  <circle className={styles.pulse} cx="580" cy="-15" r="5" fill="#19e08f" />
                  <circle cx="580" cy="-15" r="5" fill="#19e08f" />
                  <g className={styles.axis}>
                    <text x="20" y="176">Wk 1</text><text x="300" y="176" textAnchor="middle">Wk 6</text><text x="580" y="176" textAnchor="end">Wk 12</text>
                  </g>
                </svg>
              </ResultsCard>

              <ResultsCard className={styles.views} motionStyle={views} label="Short-form views generated" note="Across TikTok, Reels & Shorts" value={150} suffix="K+">
                <div className={styles.bars} aria-hidden="true">
                  {VIEW_BARS.map((height, index) => <span key={index} style={{ "--bar-height": height, "--index": index } as CSSProperties} />)}
                </div>
              </ResultsCard>

              <ResultsCard className={styles.turnaround} motionStyle={turnaround} label="Average turnaround" note="From YouTube link to 10 clips" value={60} suffix="s">
                <div className={styles.comparison}>
                  <div>Manual editing · 6 hrs <div className={styles.track} aria-hidden="true"><span /></div></div>
                  <div>RelatiV · 5 min <div className={styles.track} aria-hidden="true"><span className={styles.fast} /></div></div>
                </div>
              </ResultsCard>

              <ResultsCard className={styles.accuracy} motionStyle={accuracy} label="Caption accuracy" note="Powered by Whisper AI" value={98.4} decimals={1} suffix="%">
                <svg className={styles.ring} viewBox="0 0 100 100" aria-hidden="true">
                  <circle className={styles.ringTrack} cx="50" cy="50" r="40" />
                  <circle className={styles.ringValue} cx="50" cy="50" r="40" pathLength="100" transform="rotate(-90 50 50)" />
                </svg>
                <div className={styles.wave} aria-hidden="true">
                  {Array.from({ length: 26 }, (_, index) => <span key={index} style={{ "--index": index, "--period": `${800 + index % 5 * 150}ms` } as CSSProperties} />)}
                </div>
              </ResultsCard>
              <ResultsCard className={`${styles.small} ${styles.picked}`} motionStyle={picked} label="Best clips picked" note="Ranked by hook strength" value={10} suffix=" of 47">
                <div className={styles.pickDots} aria-hidden="true">
                  {Array.from({ length: 47 }, (_, index) => <span key={index} data-picked={PICKED_CLIPS.has(index)} />)}
                </div>
              </ResultsCard>
              <ResultsCard className={`${styles.small} ${styles.export}`} motionStyle={exported} label="Export format" note="Vertical H.264, ready to post" value={9} suffix=":16">
                <div className={`${styles.bars} ${styles.exportBars}`} aria-hidden="true">
                  {EXPORT_BARS.map((height, index) => <span key={index} data-accent={height > 18} style={{ "--bar-height": height / 110, "--index": index } as CSSProperties} />)}
                </div>
              </ResultsCard>
              <ResultsCard className={`${styles.small} ${styles.free}`} motionStyle={free} label="Free to start" note="Paste a YouTube link and clip" value={60} suffix=" mins">
                <div className={styles.steps}>
                  {["Paste", "Clip", "Export"].map((step) => <span key={step}>{step}</span>)}
                </div>
              </ResultsCard>
            </div>
          </div>
        </div>
        <div className={styles.prompt}>
          <div><p>Got a long video?</p><p>Just paste the link.</p></div>
          <a href="#homepage-hero" aria-label="Paste a link and clip"><Sparkles aria-hidden="true" size={34} /></a>
        </div>
      </div>
    </section>
  );
}
