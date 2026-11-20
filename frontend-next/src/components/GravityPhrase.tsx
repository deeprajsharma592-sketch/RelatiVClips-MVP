"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

type GravityPhraseProps = {
  phrases: string[];
  interval?: number;
};

type Grain = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  size: number;
  glyph: string;
  state: "anchored" | "falling" | "returning";
  returnAt: number;
};

const GLYPHS = "RELATIV0123456789+*/";
const GRAIN_GAP = 5.5;
const GRAVITY = 980;

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const x = ax + t * dx;
  const y = ay + t * dy;
  return Math.hypot(px - x, py - y);
}

/** Locally recreated glyph-sand headline: swipe to slice it, click to collapse it. */
export default function GravityPhrase({ phrases, interval = 5200 }: GravityPhraseProps) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grainsRef = useRef<Grain[]>([]);
  const rebuildRef = useRef<((text: string, rising?: boolean) => void) | null>(null);
  const phraseIndexRef = useRef(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const reduceMotion = useReducedMotion();
  const phrase = phrases[phraseIndex] ?? phrases[0] ?? "";

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d", { alpha: true });
    if (!root || !canvas || !ctx) return;

    let frame = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let resizeFrame = 0;
    let collapseTimer = 0;
    let lastPoint: { x: number; y: number } | null = null;
    const pointer = { down: false, moved: false, startX: 0, startY: 0 };

    const makeGrains = (text: string, rising = false) => {
      if (!width || !height || !text) return;
      const computed = window.getComputedStyle(root);
      const requestedSize = Number.parseFloat(computed.fontSize) || 64;
      const fontFamily = computed.fontFamily || "sans-serif";
      const fontWeight = computed.fontWeight || "800";
      const fontCanvas = document.createElement("canvas");
      const fontContext = fontCanvas.getContext("2d");
      if (!fontContext) return;

      let fontSize = Math.min(requestedSize, height * 0.9);
      fontContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      while (fontContext.measureText(text).width > width * 0.94 && fontSize > 12) {
        fontSize -= 1;
        fontContext.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      }

      fontCanvas.width = Math.ceil(width * dpr);
      fontCanvas.height = Math.ceil(height * dpr);
      const raster = fontCanvas.getContext("2d", { willReadFrequently: true });
      if (!raster) return;
      raster.scale(dpr, dpr);
      raster.clearRect(0, 0, width, height);
      raster.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      raster.textAlign = "center";
      raster.textBaseline = "middle";
      raster.fillStyle = "#fff";
      raster.fillText(text, width / 2, height / 2, width * 0.94);

      const pixels = raster.getImageData(0, 0, fontCanvas.width, fontCanvas.height);
      const gap = Math.max(2, Math.round(GRAIN_GAP * dpr));
      const next: Grain[] = [];
      for (let py = gap / 2; py < fontCanvas.height; py += gap) {
        for (let px = gap / 2; px < fontCanvas.width; px += gap) {
          if (pixels.data[(Math.floor(py) * fontCanvas.width + Math.floor(px)) * 4 + 3] < 92) continue;
          const homeX = px / dpr;
          const homeY = py / dpr;
          next.push({
            x: rising ? width / 2 + (Math.random() - 0.5) * width * 0.55 : homeX,
            y: rising ? height + Math.random() * height * 0.65 : homeY,
            homeX,
            homeY,
            vx: rising ? (Math.random() - 0.5) * 65 : 0,
            vy: rising ? -Math.random() * 120 : 0,
            rotation: rising ? (Math.random() - 0.5) * 1.2 : 0,
            spin: rising ? (Math.random() - 0.5) * 2 : 0,
            size: 4.8 + Math.random() * 1.5,
            glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
            state: rising ? "returning" : "anchored",
            returnAt: performance.now() + (rising ? 220 + Math.random() * 680 : 0),
          });
        }
      }
      grainsRef.current = next;
    };
    rebuildRef.current = makeGrains;

    const resize = () => {
      const bounds = root.getBoundingClientRect();
      if (bounds.width < 1 || bounds.height < 1) return;
      width = bounds.width;
      height = bounds.height;
      dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      makeGrains(phrases[phraseIndexRef.current] ?? phrases[0] ?? "");
    };

    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };

    const collapse = (x?: number, y?: number) => {
      const now = performance.now();
      for (const grain of grainsRef.current) {
        grain.state = "falling";
        grain.vx = (grain.x - (x ?? width / 2)) * 0.45 + (Math.random() - 0.5) * 135;
        grain.vy = -45 - Math.random() * 110;
        grain.spin = (Math.random() - 0.5) * 5;
        grain.returnAt = now + 820 + Math.random() * 420;
      }
      window.clearTimeout(collapseTimer);
      collapseTimer = window.setTimeout(() => {
        for (const grain of grainsRef.current) grain.state = "returning";
      }, 1040);
    };

    const cut = (fromX: number, fromY: number, toX: number, toY: number) => {
      const dx = toX - fromX;
      const dy = toY - fromY;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;
      const now = performance.now();
      for (const grain of grainsRef.current) {
        if (grain.state !== "anchored" || distanceToSegment(grain.x, grain.y, fromX, fromY, toX, toY) > 9) continue;
        const side = grain.y < (fromY + toY) / 2 ? -1 : 1;
        grain.state = "falling";
        grain.vx = dx / length * 45 + nx * side * (35 + Math.random() * 75);
        grain.vy = dy / length * 24 + ny * side * 26 - 25;
        grain.spin = (Math.random() - 0.5) * 5;
        grain.returnAt = now + 1350 + Math.random() * 700;
      }
    };

    const localPoint = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const point = localPoint(event);
      pointer.down = true;
      pointer.moved = false;
      pointer.startX = point.x;
      pointer.startY = point.y;
      lastPoint = point;
      canvas.setPointerCapture?.(event.pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointer.down) return;
      const point = localPoint(event);
      if (Math.hypot(point.x - pointer.startX, point.y - pointer.startY) > 7) pointer.moved = true;
      if (pointer.moved && lastPoint) cut(lastPoint.x, lastPoint.y, point.x, point.y);
      lastPoint = point;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!pointer.down) return;
      pointer.down = false;
      if (!pointer.moved) collapse(pointer.startX, pointer.startY);
      lastPoint = null;
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };

    let lastFrame = 0;
    const draw = (time: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const dt = lastFrame ? Math.min(0.032, Math.max(0.001, (time - lastFrame) / 1000)) : 0.016;
      lastFrame = time;

      for (const grain of grainsRef.current) {
        if (grain.state === "falling") {
          grain.vy += GRAVITY * dt;
          grain.x += grain.vx * dt;
          grain.y += grain.vy * dt;
          grain.rotation += grain.spin * dt;
          grain.vx *= 0.995;
          if (grain.y > height + 70 || time > grain.returnAt) grain.state = "returning";
        }
        if (grain.state === "returning" && time >= grain.returnAt) {
          const spring = Math.min(1, dt * 8.5);
          grain.x += (grain.homeX - grain.x) * spring;
          grain.y += (grain.homeY - grain.y) * spring;
          grain.rotation *= 1 - spring;
          if (Math.hypot(grain.homeX - grain.x, grain.homeY - grain.y) < 0.8) {
            grain.x = grain.homeX;
            grain.y = grain.homeY;
            grain.rotation = 0;
            grain.state = "anchored";
          }
        }

        const loose = grain.state !== "anchored";
        const hue = (grain.homeX / Math.max(1, width)) * 48;
        ctx.save();
        ctx.translate(grain.x, grain.y);
        ctx.rotate(grain.rotation);
        ctx.globalAlpha = loose ? 0.96 : 0.95;
        ctx.fillStyle = loose ? `hsl(${20 + hue} 96% 62%)` : "#ffffff";
        ctx.font = `700 ${grain.size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(grain.glyph, 0, 0);
        ctx.restore();
      }
      frame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(scheduleResize);
    observer.observe(root);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    document.fonts?.ready.then(scheduleResize);
    scheduleResize();
    frame = requestAnimationFrame(draw);

    return () => {
      rebuildRef.current = null;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(resizeFrame);
      window.clearTimeout(collapseTimer);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }, [phrases]);

  useEffect(() => {
    rebuildRef.current?.(phrase, true);
  }, [phraseIndex, phrase]);

  useEffect(() => {
    if (reduceMotion || phrases.length < 2) return;
    let transitionTimer = 0;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const nextIndex = (phraseIndexRef.current + 1) % phrases.length;
      // Give the outgoing glyphs time to fall, then let the canvas rebuild the next phrase.
      const grains = grainsRef.current;
      const now = performance.now();
      for (const grain of grains) {
        grain.state = "falling";
        grain.vx = (Math.random() - 0.5) * 80;
        grain.vy = -20 - Math.random() * 90;
        grain.spin = (Math.random() - 0.5) * 4;
        grain.returnAt = now + 760 + Math.random() * 180;
      }
      window.clearTimeout(transitionTimer);
      transitionTimer = window.setTimeout(() => {
        phraseIndexRef.current = nextIndex;
        setPhraseIndex(nextIndex);
      }, 880);
    }, interval);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(transitionTimer);
    };
  }, [interval, phrases, reduceMotion]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex h-[1.38em] w-full items-center justify-center overflow-visible pointer-events-auto"
    >
      {reduceMotion ? (
        <span className="whitespace-nowrap">{phrases[0] ?? phrase}</span>
      ) : (
        <>
          <span className="sr-only" aria-live="polite">{phrase}</span>
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="block h-full w-full touch-none select-none cursor-crosshair"
            style={{ touchAction: "none" }}
          />
        </>
      )}
    </span>
  );
}
