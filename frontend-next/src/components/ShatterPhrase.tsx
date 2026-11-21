"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type Point = { x: number; y: number };
type Flight = {
  start: number;
  x: number;
  y: number;
  depth: number;
  spin: number;
  flip: number;
  hold: number;
};
type Shard = {
  center: Point;
  path: Path2D;
  flight?: Flight;
  color: string;
};
type Crack = { center: Point; path: Path2D; until: number };

type PhraseLayout = { ink: HTMLCanvasElement; splitX: number; fontSize: number; shards: Shard[]; cracks: Crack[] };
type MorphShard = {
  from: Shard;
  to: Shard;
  extraFrom: boolean;
  extraTo: boolean;
  drift: Point;
  spin: number;
  flip: number;
  delay: number;
};
type Morph = { start: number; next: number; target: PhraseLayout; pieces: MorphShard[] };

// Light tints of the logo's amber, coral, and pink.
const PHRASE_COLORS = ["#ffe0a5", "#ffbfae", "#f8afd8"] as const;
const SHARD_COLORS = ["#da9e53", "#d78072", "#cf74aa"] as const;

const TAU = 2 * Math.PI;
const MORPH_DURATION = 1580;
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));
const smooth = (n: number) => n * n * (3 - 2 * n);

export default function ShatterPhrase({
  phrases,
  thumbnailSlot,
}: {
  phrases: readonly string[];
  thumbnailSlot?: ReactNode;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas || !phrases.length) return;
    const slot = root.querySelector<HTMLElement>("[data-thumbnail-slot]");
    const output = canvas.getContext("2d");
    if (!output) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active = true;
    let frame = 0;
    let wakeup = 0;
    let visible = true;
    let dirty = true;
    let phrase = 0;
    let width = 0;
    let height = 0;
    let ratio = 1;
    let current: PhraseLayout | undefined;
    let morph: Morph | undefined;
    let nextBurst = 0;

    function build(text: string): PhraseLayout | undefined {
      if (!root || !width || !height) return;
      const ink = document.createElement("canvas");
      ink.width = Math.ceil(width * ratio);
      ink.height = Math.ceil(height * ratio);
      const source = ink.getContext("2d", { willReadFrequently: true });
      if (!source) return;
      const style = getComputedStyle(root);
      const font = (size: number) => `800 ${size}px ${style.fontFamily}`;
      const suggested = parseFloat(style.fontSize);
      source.setTransform(ratio, 0, 0, ratio, 0, 0);
      source.font = font(suggested);
      const available = Math.max(1, width * 0.94 - (slot ? suggested * 0.82 : 0));
      const fontSize = Math.min(suggested, (available * suggested) / Math.max(1, source.measureText(text).width));
      source.font = font(fontSize);
      source.textAlign = "center";
      const metrics = source.measureText(text);
      // Split in whitespace closest to the visual center, between whole words.
      const spaceWidth = source.measureText(" ").width;
      const split = Array.from(text.matchAll(/ /g), ({ index }) =>
        source.measureText(text.slice(0, index)).width + spaceWidth / 2 - metrics.width / 2,
      ).reduce((nearest, offset) => Math.abs(offset) < Math.abs(nearest) ? offset : nearest, Infinity);
      const splitX = width / 2 + (Number.isFinite(split) ? split : 0);
      const baseline = height / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
      const leftInk = width / 2 - metrics.actualBoundingBoxLeft;
      const rightInk = width / 2 + metrics.actualBoundingBoxRight;
      const inkGradient = source.createLinearGradient(leftInk, 0, rightInk, 0);
      PHRASE_COLORS.forEach((color, index) => {
        inkGradient.addColorStop(index / (PHRASE_COLORS.length - 1), color);
      });
      source.fillStyle = inkGradient;
      source.fillText(text, width / 2, baseline);
      const pixels = source.getImageData(0, 0, ink.width, ink.height).data;
      const step = Math.max(6, fontSize * 0.15);
      const left = leftInk - step;
      const right = rightInk + step;
      const top = baseline - metrics.actualBoundingBoxAscent - step;
      const bottom = baseline + metrics.actualBoundingBoxDescent + step;
      const cols = Math.ceil((right - left) / step);
      const rows = Math.ceil((bottom - top) / step);
      const vertices = Array.from({ length: rows + 1 }, (_, row) =>
        Array.from({ length: cols + 1 }, (_, col) => ({
          x: left + col * step + (Math.random() - 0.5) * step * 0.65,
          y: top + row * step + (Math.random() - 0.5) * step * 0.65,
        })),
      );
      const shards: Shard[] = [];
      const cracks: Crack[] = [];
      const edges = new Set<string>();

      function addShard(a: Point, b: Point, c: Point) {
        const center = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
        let hasInk = false;
        for (let u = 0; u <= 8 && !hasInk; u++) {
          for (let v = 0; v <= 8 - u && !hasInk; v++) {
            const w = 8 - u - v;
            const x = Math.floor(((a.x * u + b.x * v + c.x * w) / 8) * ratio);
            const y = Math.floor(((a.y * u + b.y * v + c.y * w) / 8) * ratio);
            hasInk = x >= 0 && y >= 0 && x < ink.width && y < ink.height &&
              pixels[(y * ink.width + x) * 4 + 3] > 24;
          }
        }
        if (!hasInk) return;

        const path = new Path2D();
        path.moveTo(a.x, a.y);
        path.lineTo(b.x, b.y);
        path.lineTo(c.x, c.y);
        path.closePath();
        const colorIndex = Math.round(clamp((center.x - leftInk) / Math.max(1, rightInk - leftInk)) * (SHARD_COLORS.length - 1));
        const shard: Shard = { path, center, color: SHARD_COLORS[colorIndex] };
        shards.push(shard);
        for (const [p, q] of [[a, b], [b, c], [c, a]]) {
          const key = [`${p.x},${p.y}`, `${q.x},${q.y}`].sort().join("|");
          if (edges.has(key)) continue;
          edges.add(key);
          const midpoint = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
          const line = new Path2D();
          line.moveTo(p.x, p.y);
          line.lineTo(midpoint.x + (q.y - p.y) * 0.16, midpoint.y - (q.x - p.x) * 0.16);
          line.lineTo(q.x, q.y);
          cracks.push({ center: midpoint, path: line, until: 0 });
        }
      }

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const a = vertices[row][col];
          const b = vertices[row][col + 1];
          const c = vertices[row + 1][col];
          const d = vertices[row + 1][col + 1];
          if (Math.random() < 0.5) {
            addShard(a, b, d);
            addShard(a, d, c);
          } else {
            addShard(a, b, c);
            addShard(b, d, c);
          }
        }
      }
      return { ink, splitX, fontSize, shards, cracks };
    }

    function burst(now: number, point: Point, { shards, fontSize }: PhraseLayout) {
      for (const shard of shards) {
        const dx = shard.center.x - point.x;
        const dy = shard.center.y - point.y;
        if (Math.hypot(dx, dy) > fontSize * 0.85) continue;
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5);
        const travel = fontSize * (0.55 + Math.random() * 0.85);
        shard.flight = {
          start: now,
          x: Math.cos(angle) * travel,
          y: Math.sin(angle) * travel,
          depth: 0.25 + Math.random() * 0.55,
          spin: (Math.random() - 0.5) * 7,
          flip: (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 8),
          hold: 750 + Math.random() * 210,
        };
      }
    }

    function startMorph(now: number, from: PhraseLayout) {
      const next = (phrase + 1) % phrases.length;
      const target = build(phrases[next]);
      if (!target?.shards.length || !from.shards.length) return;
      const byPosition = (a: Shard, b: Shard) => a.center.x - b.center.x;
      const outgoing = [...from.shards].sort(byPosition);
      const incoming = [...target.shards].sort(byPosition);
      const count = Math.max(outgoing.length, incoming.length);
      const pieces = Array.from({ length: count }, (_, i) => {
        const fromIndex = Math.floor(i * outgoing.length / count);
        const toIndex = Math.floor(i * incoming.length / count);
        const fromShard = outgoing[fromIndex];
        const toShard = incoming[toIndex];
        const left = Math.min(fromShard.center.x, toShard.center.x);
        const right = Math.max(fromShard.center.x, toShard.center.x);
        const top = Math.min(fromShard.center.y, toShard.center.y);
        const bottom = Math.max(fromShard.center.y, toShard.center.y);
        const padding = Math.max(from.fontSize, target.fontSize) * 0.2;
        const angle = Math.random() * TAU;
        const distance = from.fontSize * (0.45 + Math.random() * 0.85);
        return {
          from: fromShard,
          to: toShard,
          extraFrom: i > 0 && fromIndex === Math.floor((i - 1) * outgoing.length / count),
          extraTo: i > 0 && toIndex === Math.floor((i - 1) * incoming.length / count),
          drift: {
            x: clamp(Math.cos(angle) * distance, Math.min(0, padding - left), Math.max(0, width - padding - right)),
            y: clamp(Math.sin(angle) * distance, Math.min(0, padding - top), Math.max(0, height - padding - bottom)),
          },
          spin: (Math.random() - 0.5) * 6,
          flip: 1.5 + Math.random() * 3.5,
          delay: i / count * 0.12,
        };
      });
      morph = { start: now, next, target, pieces };
      root?.dispatchEvent(new Event("hero-phrase-shatter", { bubbles: true }));
    }

    function drawMorph(ctx: CanvasRenderingContext2D, now: number, from: PhraseLayout, transition: Morph) {
      const progress = clamp((now - transition.start) / MORPH_DURATION);
      const intactFrom = 1 - smooth(clamp(progress / 0.09));
      const intactTo = smooth(clamp((progress - 0.88) / 0.12));
      for (const piece of transition.pieces) {
        const t = clamp((progress - piece.delay) / (0.94 - piece.delay));
        const travel = smooth(t);
        const arc = Math.sin(Math.PI * travel);
        const x = piece.from.center.x * (1 - travel) + piece.to.center.x * travel + piece.drift.x * arc;
        const y = piece.from.center.y * (1 - travel) + piece.to.center.y * travel + piece.drift.y * arc;
        const blend = smooth(clamp((t - 0.25) / 0.5));
        const face = Math.cos(piece.flip * arc);
        const depth = 1 + 0.35 * arc;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(piece.spin * arc);
        ctx.scale(Math.max(0.08, Math.abs(face)) * depth, depth);
        drawPiece(piece.from, from.ink, (1 - blend) * (piece.extraFrom ? blend : 1));
        drawPiece(piece.to, transition.target.ink, blend * (piece.extraTo ? 1 - blend : 1));
        ctx.restore();

        function drawPiece(shard: Shard, ink: HTMLCanvasElement, opacity: number) {
          const alpha = opacity * (1 - intactFrom) * (1 - intactTo);
          if (alpha <= 0) return;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(-shard.center.x, -shard.center.y);
          if (face < 0) {
            ctx.fillStyle = shard.color;
            ctx.fill(shard.path);
          } else {
            ctx.clip(shard.path);
            ctx.drawImage(ink, 0, 0, width, height);
          }
          ctx.restore();
        }
      }
      ctx.globalAlpha = intactFrom;
      ctx.drawImage(from.ink, 0, 0, width, height);
      ctx.globalAlpha = intactTo;
      ctx.drawImage(transition.target.ink, 0, 0, width, height);
      ctx.globalAlpha = 1;
    }

    function render(now: number) {
      frame = 0;
      if (!active || !visible || document.hidden || media.matches || !output || !root || !canvas) return;
      if (dirty) {
        width = root.clientWidth;
        height = root.clientHeight * 2;
        if (!width || !height) return;
        ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.ceil(width * ratio);
        canvas.height = Math.ceil(height * ratio);
        current = build(phrases[phrase]);
        if (current && slot) slot.style.left = `${current.splitX}px`;
        setReady(Boolean(current?.shards.length));
        dirty = false;
        nextBurst = now + 4800;
        morph = undefined;
      }
      if (!current) return;
      if (morph && now >= morph.start + MORPH_DURATION) {
        phrase = morph.next;
        setIndex(phrase);
        current = morph.target;
        if (slot) slot.style.left = `${current.splitX}px`;
        root?.dispatchEvent(new Event("hero-phrase-settled", { bubbles: true }));
        nextBurst = now + 4800;
        morph = undefined;
      } else if (!morph && phrases.length > 1 && now >= nextBurst) {
        startMorph(now, current);
        nextBurst = now + 4800;
      }

      output.setTransform(ratio, 0, 0, ratio, 0, 0);
      output.clearRect(0, 0, width, height);
      if (morph) {
        drawMorph(output, now, current, morph);
        schedule();
        return;
      }

      const { ink, splitX, shards, cracks } = current;
      const gap = slot?.getBoundingClientRect().width ?? 0;
      if (gap > 0 && !shards.some((shard) => shard.flight)) {
        // Draw the same raster on either side of the opening so the gradient stays continuous.
        output.save();
        output.beginPath();
        output.rect(0, 0, splitX - gap / 2, height);
        output.clip();
        output.drawImage(ink, -gap / 2, 0, width, height);
        output.restore();
        output.save();
        output.beginPath();
        output.rect(splitX + gap / 2, 0, width - splitX - gap / 2, height);
        output.clip();
        output.drawImage(ink, gap / 2, 0, width, height);
        output.restore();
        schedule();
        return;
      }
      output.drawImage(ink, 0, 0, width, height);
      const moving: { shard: Shard; flight: Flight; offset: number }[] = [];
      output.globalCompositeOperation = "destination-out";
      for (const shard of shards) {
        const flight = shard.flight;
        if (!flight) continue;
        const elapsed = now - flight.start;
        const settle = Math.max(0, (elapsed - flight.hold) / 540);
        if (settle >= 1) {
          shard.flight = undefined;
          continue;
        }
        const offset = elapsed >= flight.hold
          ? Math.exp(-6 * settle) * Math.cos(settle * 8)
          : 1 - Math.exp(-elapsed / 160);
        moving.push({ shard, flight, offset });
        output.fill(shard.path);
      }
      let cracking = false;
      output.lineWidth = 1.25;
      for (const crack of cracks) {
        if (crack.until <= now) continue;
        cracking = true;
        output.globalAlpha = Math.min(0.9, (crack.until - now) / 550);
        output.stroke(crack.path);
      }
      output.globalAlpha = 1;
      output.globalCompositeOperation = "source-over";

      for (const { shard, flight, offset } of moving) {
        const { x, y } = shard.center;
        const face = Math.cos(flight.flip * offset);
        const depth = 1 + flight.depth * Math.max(0, offset);
        output.save();
        output.translate(x + flight.x * offset, y + flight.y * offset);
        output.rotate(flight.spin * offset);
        output.scale(face * depth, depth);
        output.translate(-x, -y);
        if (face > 0) {
          output.clip(shard.path);
          output.drawImage(ink, 0, 0, width, height);
        } else {
          output.fillStyle = shard.color;
          output.fill(shard.path);
        }
        output.restore();
      }
      if (moving.length || cracking || slot?.hasAttribute("data-open")) schedule();
      else if (phrases.length > 1) {
        wakeup = window.setTimeout(schedule, Math.max(0, nextBurst - now));
      }
    }

    function schedule() {
      if (active && visible && !document.hidden && !media.matches && !frame) {
        window.clearTimeout(wakeup);
        frame = requestAnimationFrame(render);
      }
    }

    function invalidate() {
      dirty = true;
      schedule();
    }

    function pointer(event: PointerEvent) {
      if (!canvas || !current || morph || media.matches) return;
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const point = {
        x: (event.clientX - bounds.left) * width / bounds.width,
        y: (event.clientY - bounds.top) * height / bounds.height,
      };
      const now = performance.now();
      for (const crack of current.cracks) {
        if (Math.hypot(point.x - crack.center.x, point.y - crack.center.y) < current.fontSize * 0.5) {
          crack.until = now + 700;
        }
      }
      if (event.type === "pointerdown" && event.button === 0) {
        burst(now, point, current);
        root?.dispatchEvent(new Event("hero-phrase-shatter", { bubbles: true }));
        nextBurst = now + 4800;
      }
      schedule();
    }

    const resize = new ResizeObserver(invalidate);
    resize.observe(root);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && nextBurst < performance.now()) nextBurst = performance.now() + 1200;
      schedule();
    });
    intersection.observe(root);
    media.addEventListener("change", invalidate);
    canvas.addEventListener("pointermove", pointer);
    canvas.addEventListener("pointerdown", pointer);
    document.addEventListener("visibilitychange", schedule);
    document.fonts.ready.then(invalidate);
    schedule();

    return () => {
      active = false;
      cancelAnimationFrame(frame);
      window.clearTimeout(wakeup);
      resize.disconnect();
      intersection.disconnect();
      media.removeEventListener("change", invalidate);
      canvas.removeEventListener("pointermove", pointer);
      canvas.removeEventListener("pointerdown", pointer);
      document.removeEventListener("visibilitychange", schedule);
    };
  }, [phrases]);

  return (
    <span ref={rootRef} className="relative flex min-h-[1.38em] w-full items-center justify-center isolate">
      <span className={ready ? "sr-only motion-reduce:not-sr-only" : undefined}>
        <span
          className="inline-block bg-clip-text text-transparent"
          style={{ backgroundImage: `linear-gradient(90deg, ${PHRASE_COLORS.join(", ")})` }}
        >
          {phrases[index]}
        </span>
      </span>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-x-0 -top-1/2 h-[200%] w-full cursor-default touch-pan-y select-none motion-reduce:hidden"
      />
      {thumbnailSlot}
    </span>
  );
}
