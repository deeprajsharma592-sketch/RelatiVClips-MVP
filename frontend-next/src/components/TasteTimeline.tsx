"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowDown, Film } from "lucide-react";
import styles from "./TasteTimeline.module.css";

const MESSAGE = "RelatiV continuously learns your content taste and becomes better at making your clips go viral";
const BEATS = [
  { text: "RelatiV", image: "portraits/neon-profile-4x5.jpg", tilt: -12 },
  { text: "continuously learns your content taste", image: "fashion/orange-visor-4x5.jpg", tilt: 10 },
  { text: "and becomes better", image: "portraits/lime-blazer-4x5.jpg", tilt: -8 },
  { text: "at making your clips", image: "fashion/chunky-knit-4x5.jpg", tilt: 12 },
  { text: "go viral", image: "portraits/tinted-glasses-4x5.jpg", tilt: -9 },
];

type Box = { x: number; y: number; width: number; height: number };
type Journey = { from: Box; to: Box };

function Thumbnail({ index }: { index: number }) {
  return <Image src={`https://ui.dimaac.com/media/${BEATS[index].image}`} alt="" fill sizes="(max-width: 640px) 18vw, 180px" unoptimized className={styles.image} />;
}

function FlyingThumbnail({ index, journey, progress }: { index: number; journey: Journey; progress: MotionValue<number> }) {
  const { from, to } = journey;
  const start = 0.2 + index * 0.035;
  const middle = start + 0.22;
  const end = start + 0.46;
  const x = useTransform(progress, [start, middle, end], [from.x, from.x + (to.x - from.x) * 0.55, to.x]);
  const y = useTransform(progress, [start, middle, end], [from.y, from.y + (to.y - from.y) * 0.35 - 45, to.y]);
  const width = useTransform(progress, [start, end], [from.width, to.width]);
  const height = useTransform(progress, [start, end], [from.height, to.height]);
  const rotate = useTransform(progress, [start, middle, end], [0, BEATS[index].tilt, 0]);
  const borderRadius = useTransform(progress, [start, end], [9, 14]);

  return <motion.div className={styles.flyingThumbnail} style={{ x, y, width, height, rotate, borderRadius }}><Thumbnail index={index} /></motion.div>;
}

export default function TasteTimeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inlineRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const targetRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  // Keep measured card positions and fades on the same frame clock in browsers
  // whose native ViewTimeline interpolation differs from the JS scroll offsets.
  const progress = useTransform(() => scrollYProgress.get());
  const textOpacity = useTransform(progress, [0, 0.32, 0.58], [1, 1, 0]);
  const textColor = useTransform(progress, [0.06, 0.25], ["rgba(255,255,255,1)", "rgba(255,255,255,0)"]);
  const timelineOpacity = useTransform(progress, [0.38, 0.66], [0, 1]);
  const hintOpacity = useTransform(progress, [0, 0.18], [1, 0]);
  const playhead = useTransform(progress, [0.66, 1], ["0%", "100%"]);
  const ready = journeys.length === BEATS.length;

  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    let active = true;
    const measure = () => {
      if (!active || !stageRef.current) return;
      const stage = stageRef.current.getBoundingClientRect();
      const relativeBox = (node: HTMLElement): Box => {
        const box = node.getBoundingClientRect();
        return { x: box.left - stage.left, y: box.top - stage.top, width: box.width, height: box.height };
      };
      const next: Journey[] = [];
      BEATS.forEach((_, index) => {
        const from = inlineRefs.current[index];
        const to = targetRefs.current[index];
        if (from && to) next.push({ from: relativeBox(from), to: relativeBox(to) });
      });
      setJourneys(next);
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(scheduleMeasure);
    if (stageRef.current) observer.observe(stageRef.current);
    if (headingRef.current) observer.observe(headingRef.current);
    document.fonts.ready.then(scheduleMeasure);
    scheduleMeasure();
    return () => { active = false; cancelAnimationFrame(frame); observer.disconnect(); };
  }, [reduceMotion]);

  return (
    <section ref={sectionRef} className={styles.section} aria-labelledby="taste-timeline-title" data-reduced-motion={reduceMotion ? "true" : undefined}>
      <div ref={stageRef} className={styles.stage}>
        <motion.h2 ref={headingRef} id="taste-timeline-title" className={styles.headline} style={reduceMotion ? undefined : { opacity: textOpacity, color: textColor }}>
          <span className="sr-only">{MESSAGE}</span>
          <span aria-hidden="true">
            {BEATS.map((beat, index) => (
              <span key={beat.text}>
                {index > 0 && " "}{beat.text}{" "}
                <span ref={(node) => { inlineRefs.current[index] = node; }} className={styles.inlineThumbnail}>
                  <span className={styles.inlineImage} style={{ opacity: ready && !reduceMotion ? 0 : 1 }}><Thumbnail index={index} /></span>
                </span>
              </span>
            ))}
          </span>
        </motion.h2>

        <motion.div className={styles.timeline} aria-hidden="true" style={reduceMotion ? undefined : { opacity: timelineOpacity }}>
          <div className={styles.toolbar}>
            <span className={styles.toolbarTitle}><Film size={15} /> Your next clip</span>
            <span className={styles.timecode}>00:00 / 00:30</span>
          </div>
          <div className={styles.ruler}>
            {["0s", "6s", "12s", "18s", "24s", "30s"].map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className={styles.track}>
            {BEATS.map((beat, index) => (
              <div ref={(node) => { targetRefs.current[index] = node; }} key={beat.image} className={styles.target}>
                {reduceMotion && <Thumbnail index={index} />}
              </div>
            ))}
          </div>
          <div className={styles.waveform}>
            {Array.from({ length: 64 }, (_, index) => <i key={index} style={{ height: `${20 + ((index * 17 + index * index * 7) % 75)}%` }} />)}
          </div>
          <div className={styles.playheadTrack}><motion.div className={styles.playhead} style={{ left: reduceMotion ? "36%" : playhead }} /></div>
        </motion.div>

        <div className={styles.flyingLayer} aria-hidden="true">
          {!reduceMotion && journeys.map((journey, index) => <FlyingThumbnail key={BEATS[index].image} index={index} journey={journey} progress={progress} />)}
        </div>
        <motion.div className={styles.scrollHint} aria-hidden="true" style={{ opacity: hintOpacity }}>Scroll to see it take shape <ArrowDown size={13} /></motion.div>
      </div>
    </section>
  );
}
