"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import StatsCassette from "./StatsCassette";
import styles from "./CreatorProof.module.css";

const VIEW_BARS = [24, 36, 28, 49, 43, 62, 54, 76, 68, 91, 82, 100];

function AnimatedMetric({
  value,
  suffix = "",
  prefix = "",
  decimals = 0,
  active,
}: {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  active: boolean;
}) {
  const [count, setCount] = useState(value);

  useEffect(() => {
    if (!active) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) {
      setCount(value);
      return;
    }

    let frame = 0;
    const startedAt = performance.now();
    const duration = 1500;
    setCount(0);

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(value * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, value]);

  return (
    <>
      <span aria-hidden="true">
        {prefix}
        {count.toFixed(decimals)}
        {suffix}
      </span>
      <span className={styles.srOnly}>
        {prefix}
        {value.toFixed(decimals)}
        {suffix}
      </span>
    </>
  );
}

export default function CreatorProof() {
  const sectionRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || active) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          observer.disconnect();
        }
      },
      { threshold: 0 },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [active]);

  return (
    <section
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="creator-results-title"
      data-creator-results
      data-visible={active}
    >
      <div className={styles.content}>
        <h2 id="creator-results-title">
          Built for creators who want to <em>grow faster.</em>
        </h2>
        <p className={styles.sub}>
          See how top short-form clippers use RelatiV to dominate the feed.
        </p>

        <div className={styles.grid}>
          <div className={`${styles.card} ${styles.mint} ${styles.accuracy}`}>
            <p className={styles.label}>Caption accuracy</p>
            <div className={styles.ring}>
              <svg aria-hidden="true" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="rgba(12,42,31,.22)"
                  strokeWidth="9"
                />
                <circle
                  className={styles.ringProgress}
                  cx="50"
                  cy="50"
                  r="42"
                  pathLength="100"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <b>
                <AnimatedMetric
                  value={98.4}
                  active={active}
                  suffix="%"
                  decimals={1}
                />
              </b>
            </div>
            <div className={styles.metric}>
              <AnimatedMetric value={150} active={active} suffix="K+" />
            </div>
            <div className={styles.detail}>
              Short-form views generated across TikTok, Reels &amp; Shorts
            </div>
          </div>

          <div className={`${styles.card} ${styles.dark} ${styles.turnaround}`}>
            <span className={styles.lightning}>⚡</span>
            <div className={styles.metric} style={{ marginTop: ".6rem" }}>
              <AnimatedMetric value={60} active={active} suffix="s" />
            </div>
            <p className={styles.label}>Average turnaround</p>
            <div className={styles.detail}>From YouTube link to 10 clips</div>
          </div>

          <div className={`${styles.card} ${styles.dark} ${styles.reach}`}>
            <p className={styles.label}>Average reach increase</p>
            <div className={styles.metric}>
              <AnimatedMetric
                value={266}
                active={active}
                prefix="+"
                suffix="%"
              />
            </div>
            <div className={styles.accent}>For long-form creators</div>
            <div className={styles.detail}>First 12 weeks</div>
          </div>

          <div className={`${styles.card} ${styles.dark} ${styles.moments}`}>
            <p className={styles.label}>
              Team of passionate clippers and creators
            </p>
            <div className={styles.avatars}>
              <span style={{ background: "#ffd6a5" }}>🧑‍💻</span>
              <span style={{ background: "#c7b8ff" }}>🎙️</span>
              <span style={{ background: "#b8e6c9" }}>🎮</span>
              <span style={{ background: "#ffb8c9" }}>🎬</span>
              <span className={styles.extra}>+2</span>
            </div>
            <p className={styles.label}>Moments picked</p>
            <div className={styles.metric} style={{ margin: ".2rem 0" }}>
              <AnimatedMetric value={10} active={active} suffix=" of 47" />
            </div>
            <div className={styles.dots} aria-hidden="true">
              {Array.from({ length: 10 }, (_, index) => (
                <i key={index} style={{ animationDelay: `${index * 180}ms` }} />
              ))}
            </div>
            <div className={styles.accent} style={{ marginTop: ".5rem" }}>
              Best hooks only
            </div>
            <svg
              aria-hidden="true"
              className={styles.coil}
              viewBox="0 0 120 150"
            >
              <defs>
                <linearGradient id="ch" x1="0" x2="1">
                  <stop offset="0" stopColor="#f4f4f6" />
                  <stop offset=".5" stopColor="#6e6e78" />
                  <stop offset="1" stopColor="#17171b" />
                </linearGradient>
              </defs>
              <g
                fill="none"
                stroke="url(#ch)"
                strokeWidth="9"
                strokeLinecap="round"
              >
                <path d="M8,20 Q60,-4 112,34" />
                <path d="M8,46 Q60,22 112,60" />
                <path d="M8,72 Q60,48 112,86" />
                <path d="M8,98 Q60,74 112,112" />
                <path d="M8,124 Q60,100 112,138" />
              </g>
            </svg>
          </div>

          <div className={`${styles.card} ${styles.mint} ${styles.showcase}`}>
            <div className={styles.stage}>
              <div className={styles.disc}></div>
              <div
                className={styles.triangle}
                style={{ left: "46%", top: "56%" }}
              ></div>
              <div
                className={styles.triangle}
                style={{ left: "42%", bottom: "12%", transform: "scale(.7)" }}
              ></div>
              <div className={styles.orbit}></div>
              <div
                className={`${styles.widget} ${styles.chartWidget}`}
                aria-hidden="true"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 50"
                  style={{ width: "100%" }}
                >
                  <path
                    d="M4,42 C24,40 32,24 52,26 C72,28 80,12 96,6"
                    fill="none"
                    stroke="#5eeaa8"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                </svg>
                <div className={styles.widgetLabel}>RETENTION</div>
              </div>
              <div
                className={`${styles.widget} ${styles.barsWidget}`}
                aria-hidden="true"
              >
                <div className={styles.widgetLabel}>AUDIENCE AGE</div>
                <div className={styles.equalizer}>
                  <b style={{ "--i": 0 } as CSSProperties}></b>
                  <b style={{ "--i": 1 } as CSSProperties}></b>
                  <b style={{ "--i": 2 } as CSSProperties}></b>
                  <b style={{ "--i": 3 } as CSSProperties}></b>
                  <b style={{ "--i": 4 } as CSSProperties}></b>
                </div>
              </div>
              <Image
                className={styles.viewer}
                alt="Excited viewer pointing at her phone while watching reels"
                draggable={false}
                width={1284}
                height={1324}
                src="/stats/viewer.webp"
                loading="lazy"
              />
              <div
                className={`${styles.widget} ${styles.playWidget}`}
                aria-hidden="true"
              >
                <b>▶</b>
                <div>
                  <div className={styles.widgetValue}>26,807</div>
                  <i></i>
                </div>
              </div>
              <div
                className={`${styles.widget} ${styles.engagementWidget}`}
                aria-hidden="true"
              >
                <div style={{ color: "#ff4d5e" }}>❤</div>
                <div className={styles.widgetValue}>19.46%</div>
                <div className={styles.widgetLabel}>Engagement rate</div>
                <div
                  className={styles.widgetLabel}
                  style={{ color: "var(--green)" }}
                >
                  ▲ 102.48%
                </div>
              </div>
            </div>
          </div>

          <div className={`${styles.card} ${styles.dark} ${styles.clips}`}>
            <p className={styles.clipHeadline}>
              <span>Turn Long</span>
              <br />
              <span>Videos Into</span>
              <br />
              <span>Viral Clips</span>
            </p>
            <div className={styles.pills}>
              <div className={`${styles.pill} ${styles.leftClip}`}>
                <Image
                  alt="Clip thumbnail: man pushing a luggage cart with a backpack of cash"
                  src="/stats/luggage.webp"
                  fill
                  sizes="120px"
                />
                <em>0:34</em>
                <b>▶</b>
              </div>
              <div className={`${styles.pill} ${styles.rightClip}`}>
                <Image
                  alt="Clip thumbnail: a baked calzone being cut with scissors"
                  src="/stats/calzone.webp"
                  fill
                  sizes="120px"
                />
                <em>0:28</em>
                <b>▶</b>
              </div>
            </div>
          </div>

          <div className={`${styles.card} ${styles.dark} ${styles.brand}`}>
            <div>
              <svg
                aria-hidden="true"
                viewBox="0 0 64 34"
                className={styles.bar}
              >
                <defs>
                  <linearGradient id="lg" x1="0" x2="1">
                    <stop offset="0" stopColor="#ffa94d" />
                    <stop offset="1" stopColor="#ff3d8b" />
                  </linearGradient>
                </defs>
                <g fill="url(#lg)">
                  <rect
                    style={{ "--i": 0 } as CSSProperties}
                    x="2"
                    y="12"
                    width="5"
                    height="10"
                    rx="2.5"
                  />
                  <rect
                    style={{ "--i": 1 } as CSSProperties}
                    x="11"
                    y="5"
                    width="5"
                    height="24"
                    rx="2.5"
                  />
                  <rect
                    style={{ "--i": 2 } as CSSProperties}
                    x="20"
                    y="9"
                    width="5"
                    height="16"
                    rx="2.5"
                  />
                  <rect
                    style={{ "--i": 3 } as CSSProperties}
                    x="29"
                    y="3"
                    width="5"
                    height="28"
                    rx="2.5"
                  />
                </g>
                <path d="M42,3 L62,17 L42,31Z" fill="#ff3d8b" />
              </svg>
              <div className={styles.brandName}>
                Relati<i>V</i>
              </div>
            </div>
          </div>

          <div className={`${styles.card} ${styles.dark} ${styles.exportCard}`}>
            <p className={styles.label}>Export</p>
            <div className={styles.big2}>9:16 H.264</div>
            <div className={styles.detail}>
              Ready for TikTok, Reels &amp; Shorts
            </div>
            <div className={styles.swatches}>
              <i style={{ background: "#555" }}></i>
              <i style={{ background: "#c9c9cf" }}></i>
              <i style={{ background: "var(--acc)" }}></i>
              <i style={{ background: "var(--lav)" }}></i>
            </div>
          </div>

          <div className={`${styles.card} ${styles.mint} ${styles.offer}`}>
            <div>
              <h3>Start with 60 minutes free</h3>
              <div className={styles.detail}>
                Paste a link. Get 10 viral clips.
              </div>
              <a className={styles.button} href="#homepage-hero">
                Get free clips ↗
              </a>
            </div>
            <StatsCassette className={styles.cassette} />
          </div>
        </div>
      </div>
    </section>
  );
}
