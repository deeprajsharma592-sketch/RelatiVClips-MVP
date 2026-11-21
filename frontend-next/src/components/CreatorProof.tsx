"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { useInView, useReducedMotion } from "framer-motion";
import styles from "./CreatorProof.module.css";

const BEFORE = "M20 170 C35.5 169.5 82 167 113 167 S175 169 206 168 S269 163 300 161 S362 159 393 158 S455 154 486 153 S564 150.5 580 150";
const AFTER = "M20 170 C35.5 166.7 82 157.3 113 150 S175 134.7 206 126 S269 107.3 300 98 S362 78.7 393 70 S455 53.3 486 46 S564 29.3 580 26";
const VIEW_BARS = [0.25, 0.32, 0.3, 0.45, 0.4, 0.55, 0.62, 0.58, 0.75, 0.82, 0.9, 1];

function ResultsCard({
  label, note, value, prefix = "", suffix, decimals = 0, className, children, indicator,
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
    <article ref={ref} className={`${styles.card} ${className}`} data-visible={visible} onPointerMove={moveSpotlight}>
      <div>
        <h3 className={styles.label}>{indicator && <span className={styles.dot} aria-hidden="true" />}{label}</h3>
        <p className={styles.metric}>
          <span className="sr-only">{prefix}{value.toFixed(decimals)}{suffix}</span>
          <span aria-hidden="true">{prefix}{(reduced ? value : displayValue).toFixed(decimals)}{suffix}</span>
        </p>
        <p className={styles.note}>{note}</p>
      </div>
      {children}
    </article>
  );
}

export default function CreatorProof() {
  const gradient = useId();

  return (
    <section className={styles.section} aria-labelledby="creator-results-title" data-creator-results>
      <div className={styles.content}>
        <h2 id="creator-results-title" className={styles.title}>Built for creators who want to <em>grow faster.</em></h2>
        <p className={styles.sub}>See how top short-form clippers use RelatiV to dominate the feed.</p>

        <div className={styles.bento}>
          <ResultsCard className={styles.reach} label="Average reach increase" note="For long-form creators, first 12 weeks" value={266} prefix="+" suffix="%" indicator>
            <div className={styles.legend} aria-hidden="true">
              <span><i />Without RelatiV</span><span><i />With RelatiV</span>
            </div>
            <svg className={styles.chart} viewBox="0 0 600 230" role="img" aria-label="Illustrative comparison of reach over 12 weeks with and without RelatiV">
              <defs>
                <linearGradient id={gradient} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop stopColor="#19e08f" stopOpacity=".35" />
                  <stop offset="100%" stopColor="#19e08f" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className={styles.gridLines}>
                {[40, 95, 150, 205].map((y) => <line key={y} x1="20" x2="580" y1={y} y2={y} />)}
              </g>
              <path className={styles.area} d={`${AFTER} L580 205 L20 205 Z`} fill={`url(#${gradient})`} />
              <path className={styles.line} d={BEFORE} pathLength="1" stroke="#4b4e5e" />
              <path className={`${styles.line} ${styles.growthLine}`} d={AFTER} pathLength="1" stroke="#19e08f" />
              <circle className={styles.pulse} cx="580" cy="26" r="5" fill="#19e08f" />
              <circle cx="580" cy="26" r="5" fill="#19e08f" />
              <g className={styles.axis}>
                <text x="20" y="224">Wk 1</text><text x="300" y="224" textAnchor="middle">Wk 6</text><text x="580" y="224" textAnchor="end">Wk 12</text>
              </g>
            </svg>
          </ResultsCard>

          <ResultsCard className={styles.views} label="Short-form views generated" note="Across TikTok, Reels & Shorts" value={150} suffix="K+">
            <div className={styles.bars} aria-hidden="true">
              {VIEW_BARS.map((height, index) => <span key={index} style={{ "--bar-height": height, "--index": index } as CSSProperties} />)}
            </div>
          </ResultsCard>

          <ResultsCard className={styles.turnaround} label="Average turnaround" note="From YouTube link to 10 clips" value={60} suffix="s">
            <div className={styles.comparison}>
              <div>Manual editing · 6 hrs <div className={styles.track} aria-hidden="true"><span /></div></div>
              <div>RelatiV · 5 min <div className={styles.track} aria-hidden="true"><span className={styles.fast} /></div></div>
            </div>
          </ResultsCard>

          <ResultsCard className={styles.accuracy} label="Caption accuracy" note="Powered by Whisper AI" value={98.4} decimals={1} suffix="%">
            <svg className={styles.ring} viewBox="0 0 100 100" aria-hidden="true">
              <circle className={styles.ringTrack} cx="50" cy="50" r="40" />
              <circle className={styles.ringValue} cx="50" cy="50" r="40" pathLength="100" transform="rotate(-90 50 50)" />
            </svg>
            <div className={styles.wave} aria-hidden="true">
              {Array.from({ length: 26 }, (_, index) => <span key={index} style={{ "--index": index, "--period": `${800 + index % 5 * 150}ms` } as CSSProperties} />)}
            </div>
          </ResultsCard>
        </div>
      </div>
    </section>
  );
}
