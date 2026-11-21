"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowDown, ArrowRight, Pause, Play, ThumbsDown, ThumbsUp } from "lucide-react";
import styles from "./TasteTimeline.module.css";

const MESSAGE = "RelatiV continuously learns your content taste and becomes better at making your clips go viral";
const BEATS = ["RelatiV", "continuously learns your content taste", "and becomes better", "at making your clips", "go viral"];
const PORTRAITS = [
  "neon-profile", "orange-visor", "lime-blazer", "chunky-knit", "tinted-glasses",
  "gold-visor", "red-coat", "purple-hoodie", "platinum-blonde", "orange-ring",
].map((name) => `/hero-wheel/${name}-4x5.jpg`);
const CLIP_IMAGES = [
  ...PORTRAITS,
  ...["l2", "r3", "l4", "r5", "l3", "r1", "l5", "r4"].map((name) => `/thumb_${name}.webp`),
];
const SCENES = [
  { label: "Hook", platform: "TikTok", title: "Nobody told me this would work", score: 88 },
  { label: "Setup", platform: "Reels", title: "Then I tried it for one week", score: 74 },
  { label: "Twist", platform: "Shorts", title: "And the result broke my brain", score: 81 },
  { label: "Peak", platform: "TikTok", title: "Everyone in the room went quiet", score: 95 },
  { label: "Payoff", platform: "Reels", title: "That is why I never go back", score: 79 },
];
const PAGE_COUNT = Math.ceil(CLIP_IMAGES.length / SCENES.length);

type Box = { x: number; y: number; width: number; height: number };
type Journey = { from: Box; to: Box; stageWidth: number };

function Thumbnail({ src }: { src: string }) {
  return <Image src={src} alt="" fill sizes="(max-width: 640px) 18vw, 180px" className={styles.image} />;
}

function FlyingThumbnail({ index, journey, progress }: { index: number; journey: Journey; progress: MotionValue<number> }) {
  const { from, to, stageWidth } = journey;
  const centerY = to.y + to.height / 2;
  const stackWidth = Math.min(stageWidth * 0.18, 118);
  const stackHeight = stackWidth * 1.55;
  const stackX = stageWidth * 0.2 - stackWidth / 2 + (index - 2) * 3;
  const portalX = stageWidth / 2 - 4;
  const phases = [0.04 + index * 0.02, 0.31 + index * 0.015, 0.55, 0.73 + index * 0.02, 0.89 + index * 0.02];
  const x = useTransform(progress, phases, [from.x, stackX, portalX, (portalX + to.x) / 2 + (index - 2) * 16, to.x]);
  const y = useTransform(progress, phases, [from.y, centerY - stackHeight / 2, centerY - stackHeight * 0.42, to.y - 32 + index * 12, to.y]);
  const width = useTransform(progress, phases, [from.width, stackWidth, 8, to.width * 0.72, to.width]);
  const height = useTransform(progress, phases, [from.height, stackHeight, stackHeight * 0.84, to.height * 0.8, to.height]);
  const rotate = useTransform(progress, phases, [0, (index - 2) * 4, 0, index % 2 ? -11 : 9, 0]);
  const opacity = useTransform(progress, [0.49, 0.55, 0.58, 0.96, 0.98], [1, 0, 1, 1, 0]);
  return (
    <motion.div className={styles.flyingThumbnail} style={{ x, y, width, height, rotate, opacity }}>
      <Thumbnail src={PORTRAITS[index]} />
    </motion.div>
  );
}

function PortalSpark({ index, progress }: { index: number; progress: MotionValue<number> }) {
  const angle = (index * 137.5) * Math.PI / 180;
  const distance = 38 + (index * 29) % 155;
  const start = 0.5 + (index % 5) * 0.027;
  const end = start + 0.2;
  const x = useTransform(progress, [start, end], [0, Math.cos(angle) * distance]);
  const y = useTransform(progress, [start, end], [0, Math.sin(angle) * distance]);
  const opacity = useTransform(progress, [start, start + 0.045, end], [0, 0.86, 0]);
  return <motion.i style={{ x, y, opacity }} />;
}

export default function TasteTimeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inlineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const targetRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [panelVisible, setPanelVisible] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [gallery, setGallery] = useState(0);
  const [time, setTime] = useState(0);
  const [scores, setScores] = useState(() => SCENES.map(({ score }) => score));
  const reduceMotion = useReducedMotion();
  const inView = useInView(stageRef);
  const selected = Math.min(SCENES.length - 1, Math.floor(time / 6));
  const scene = SCENES[selected];
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const progress = useTransform(() => scrollYProgress.get());
  const textOpacity = useTransform(progress, [0.03, 0.31], [1, 0]);
  const timelineOpacity = useTransform(progress, [0.7, 0.96], [0, 1]);
  const portalOpacity = useTransform(progress, [0.14, 0.27, 0.8, 0.92], [0, 1, 1, 0]);
  const sourceOpacity = useTransform(progress, [0.22, 0.34, 0.43, 0.5], [0, 1, 1, 0]);
  const cardsOpacity = useTransform(progress, [0.95, 0.98], [0, 1]);
  const ready = journeys.length === BEATS.length;

  useMotionValueEvent(progress, "change", (value) => setPanelVisible(value >= 0.97));

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    let active = true;
    function measure() {
      if (!active || !stageRef.current) return;
      const stage = stageRef.current.getBoundingClientRect();
      const relative = (node: HTMLElement): Box => {
        const box = node.getBoundingClientRect();
        return { x: box.left - stage.left, y: box.top - stage.top, width: box.width, height: box.height };
      };
      const next = BEATS.flatMap((_, index) => {
        const from = inlineRefs.current[index];
        const to = targetRefs.current[index];
        return from && to ? [{ from: relative(from), to: relative(to), stageWidth: stage.width }] : [];
      });
      setJourneys(next);
      setPanelVisible(scrollYProgress.get() >= 0.97);
    }
    function queueMeasure() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    const observer = new ResizeObserver(queueMeasure);
    if (stageRef.current) observer.observe(stageRef.current);
    if (headingRef.current) observer.observe(headingRef.current);
    document.fonts.ready.then(() => { if (active) queueMeasure(); });
    queueMeasure();
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [reduceMotion, scrollYProgress]);

  useEffect(() => {
    if (!playing || !panelVisible || !inView || reduceMotion) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setTime((value) => (value + 0.1) % 30);
    }, 100);
    return () => window.clearInterval(timer);
  }, [inView, panelVisible, playing, reduceMotion]);

  const canInteract = Boolean(reduceMotion || panelVisible);
  const score = Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  const seconds = Math.floor(time).toString().padStart(2, "0");

  function rate(amount: number) {
    setScores((values) => values.map((value, index) =>
      index === selected ? Math.max(5, Math.min(99, value + amount)) : value));
  }

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="taste-timeline-title">
      <div ref={stageRef} className={styles.stage} data-taste-redesign>
        <motion.h2 ref={headingRef} id="taste-timeline-title" className={styles.headline} style={reduceMotion ? undefined : { opacity: textOpacity }}>
          <span className="sr-only">{MESSAGE}</span>
          <span aria-hidden="true">
            {BEATS.map((text, index) => (
              <span key={text}>
                {index > 0 && " "}{text}{" "}
                <span ref={(node) => { inlineRefs.current[index] = node; }} className={styles.inlineThumbnail}>
                  <span className={styles.inlineImage} style={{ opacity: ready && !reduceMotion ? 0 : 1 }}>
                    <Thumbnail src={PORTRAITS[index]} />
                  </span>
                </span>
              </span>
            ))}
          </span>
        </motion.h2>

        <motion.div className={styles.portal} style={{ opacity: portalOpacity }} aria-hidden="true">
          <span>Drop video</span>
          <div className={styles.portalMark}>
            <Image src="/relativ-mark.svg" alt="" width={32} height={17} />
          </div>
          <span>Get viral videos</span>
        </motion.div>
        <motion.span className={styles.sourceLabel} style={{ opacity: sourceOpacity }} aria-hidden="true">Your long video · 48:12</motion.span>
        <div className={styles.sparks} aria-hidden="true">
          {Array.from({ length: 16 }, (_, index) => <PortalSpark key={index} index={index} progress={progress} />)}
        </div>

        <motion.div className={styles.timeline} inert={!canInteract} style={reduceMotion ? undefined : { opacity: timelineOpacity }}>
          <div className={styles.toolbar}>
            <strong>Sample clip</strong>
            <div className={styles.toolbarControls}>
              <span>Taste match <b>{score}%</b></span>
              <span className={styles.timecode}>00:{seconds} / 00:30</span>
              {!reduceMotion && (
                <button type="button" className={styles.playButton} aria-label={playing ? "Pause sample timeline" : "Play sample timeline"} onClick={() => setPlaying(!playing)}>
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
              )}
            </div>
          </div>
          <div className={styles.ruler} aria-hidden="true">
            {SCENES.map(({ label }, index) => <span key={label}>{index * 6}s</span>)}
          </div>
          <div className={styles.track}>
            {SCENES.map((clip, index) => (
              <motion.button
                type="button"
                key={clip.label}
                ref={(node) => { targetRefs.current[index] = node; }}
                className={styles.target}
                style={reduceMotion ? undefined : { opacity: cardsOpacity }}
                onClick={() => { setTime(index * 6); setPlaying(false); }}
                aria-label={`${clip.label}: ${clip.title}`}
                aria-pressed={index === selected}
              >
                <Thumbnail src={CLIP_IMAGES[(gallery * SCENES.length + index) % CLIP_IMAGES.length]} />
                <span className={styles.clipScore}>{(scores[index] / 10).toFixed(1)}</span>
                <span className={styles.platform}>{clip.platform}</span>
                <span className={styles.clipLabel}>{clip.label}</span>
              </motion.button>
            ))}
            <div className={styles.playhead} style={{ left: `${time / 30 * 100}%` }} aria-hidden="true" />
          </div>
          <div className={styles.waveform} aria-hidden="true">
            {Array.from({ length: 64 }, (_, index) => (
              <i key={index} data-played={index / 64 < time / 30} style={{ height: `${20 + ((index * 17 + index * index * 7) % 75)}%` }} />
            ))}
          </div>
          <div className={styles.below}>
            <div className={styles.caption}><small>{scene.label} · Hook strength {scores[selected]}</small>{scene.title}</div>
            <div className={styles.feedback}>
              <button type="button" onClick={() => rate(5)}><ThumbsUp size={14} /> More like this</button>
              <button type="button" onClick={() => rate(-7)}><ThumbsDown size={14} /> Less like this</button>
              <button type="button" onClick={() => { setGallery((value) => (value + 1) % PAGE_COUNT); setTime(0); }}>Next clips <ArrowRight size={14} /></button>
            </div>
          </div>
        </motion.div>

        <div className={styles.flyingLayer} aria-hidden="true">
          {!reduceMotion && journeys.map((journey, index) => <FlyingThumbnail key={BEATS[index]} index={index} journey={journey} progress={progress} />)}
        </div>
        <div className={styles.scrollHint}>Scroll <ArrowDown size={13} aria-hidden="true" /></div>
      </div>
    </section>
  );
}
