"use client";

import { useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Flight = {
  start: number;
  x: number;
  y: number;
  depth: number;
  spin: number;
  flip: number;
  hold: number;
  incoming?: boolean;
};
type Shard = {
  center: Point;
  path: Path2D;
  flight?: Flight;
  color: string;
};
type Crack = { center: Point; path: Path2D; until: number };

const TAU = 2 * Math.PI;

export default function ShatterPhrase({ phrases }: { phrases: readonly string[] }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas || !phrases.length) return;
    const output = canvas.getContext("2d");
    const ink = document.createElement("canvas");
    const source = ink.getContext("2d", { willReadFrequently: true });
    if (!output || !source) return;

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
    let fontSize = 0;
    let shards: Shard[] = [];
    let cracks: Crack[] = [];
    let changeAt = 0;
    let nextBurst = 0;

    function layout(now: number, incoming: boolean) {
      if (!root || !canvas || !source) return;
      width = root.clientWidth;
      height = root.clientHeight * 2;
      if (!width || !height) return;
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = ink.width = Math.ceil(width * ratio);
      canvas.height = ink.height = Math.ceil(height * ratio);
      const style = getComputedStyle(root);
      const text = phrases[phrase];
      const font = (size: number) => `800 ${size}px ${style.fontFamily}`;
      const suggested = parseFloat(style.fontSize);
      source.setTransform(ratio, 0, 0, ratio, 0, 0);
      source.font = font(suggested);
      fontSize = Math.min(suggested, (width * 0.94 * suggested) / Math.max(1, source.measureText(text).width));
      source.font = font(fontSize);
      source.textAlign = "center";
      const metrics = source.measureText(text);
      const baseline = height / 2 + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
      source.fillStyle = "#f4f4f7";
      source.fillText(text, width / 2, baseline);
      const pixels = source.getImageData(0, 0, ink.width, ink.height).data;
      const step = Math.max(6, fontSize * 0.15);
      const left = width / 2 - metrics.actualBoundingBoxLeft - step;
      const right = width / 2 + metrics.actualBoundingBoxRight + step;
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
      shards = [];
      cracks = [];
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
        const shard: Shard = { path, center, color: Math.random() < 0.7 ? "#8f70ff" : "#b0aacb" };
        if (incoming) {
          const angle = Math.random() * TAU;
          const travel = fontSize * (0.5 + Math.random() * 0.9);
          shard.flight = {
            start: now + ((center.x - left) / Math.max(1, right - left)) * 280 + Math.random() * 100,
            x: Math.cos(angle) * travel,
            y: Math.sin(angle) * travel,
            depth: 0.55,
            spin: (Math.random() - 0.5) * 7,
            flip: (Math.random() - 0.5) * 10,
            hold: 0,
            incoming: true,
          };
        }
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
      setReady(shards.length > 0);
    }

    function burst(now: number, point?: Point) {
      for (const shard of shards) {
        const dx = shard.center.x - (point?.x ?? width / 2);
        const dy = shard.center.y - (point?.y ?? height / 2);
        if (point && Math.hypot(dx, dy) > fontSize * 0.85) continue;
        const angle = (point ? Math.atan2(dy, dx) : Math.random() * TAU) + (Math.random() - 0.5);
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

    function render(now: number) {
      frame = 0;
      if (!active || !visible || document.hidden || media.matches || !output) return;
      if (dirty) {
        layout(now, false);
        dirty = false;
        nextBurst = now + 4800;
        changeAt = 0;
      }
      if (changeAt && now >= changeAt) {
        phrase = (phrase + 1) % phrases.length;
        setIndex(phrase);
        layout(now, true);
        nextBurst = now + 5000;
        changeAt = 0;
      } else if (!changeAt && phrases.length > 1 && now >= nextBurst) {
        burst(now);
        changeAt = now + 740;
      }

      output.setTransform(ratio, 0, 0, ratio, 0, 0);
      output.clearRect(0, 0, width, height);
      output.drawImage(ink, 0, 0, width, height);
      const moving: { shard: Shard; flight: Flight; offset: number; alpha: number }[] = [];
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
        const offset = flight.incoming || elapsed >= flight.hold
          ? Math.exp(-6 * settle) * Math.cos(settle * 8)
          : 1 - Math.exp(-elapsed / 160);
        const alpha = flight.incoming ? Math.min(1, elapsed / 180) : 1;
        moving.push({ shard, flight, offset, alpha });
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

      for (const { shard, flight, offset, alpha } of moving) {
        if (alpha <= 0) continue;
        const { x, y } = shard.center;
        const face = Math.cos(flight.flip * offset);
        const depth = 1 + flight.depth * Math.max(0, offset);
        output.save();
        output.globalAlpha = alpha;
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
      if (moving.length || cracking || changeAt) schedule();
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
      if (!canvas || media.matches) return;
      const bounds = canvas.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const point = {
        x: (event.clientX - bounds.left) * width / bounds.width,
        y: (event.clientY - bounds.top) * height / bounds.height,
      };
      const now = performance.now();
      for (const crack of cracks) {
        if (Math.hypot(point.x - crack.center.x, point.y - crack.center.y) < fontSize * 0.5) {
          crack.until = now + 700;
        }
      }
      if (event.type === "pointerdown" && event.button === 0 && !changeAt) {
        burst(now, point);
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
      <span className={ready ? "sr-only motion-reduce:not-sr-only" : undefined}>{phrases[index]}</span>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-x-0 -top-1/2 h-[200%] w-full cursor-crosshair touch-pan-y select-none motion-reduce:hidden"
      />
    </span>
  );
}
