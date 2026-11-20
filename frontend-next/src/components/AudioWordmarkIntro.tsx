"use client";

import React, { useEffect, useRef, useState } from "react";

export interface AudioWordmarkIntroProps {
  onComplete?: () => void;
  durationMs?: number; // Total display duration before fade out starts (default: 2000ms)
}

export default function AudioWordmarkIntro({
  onComplete,
  durationMs = 2100,
}: AudioWordmarkIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"active" | "fading" | "done">("active");

  useEffect(() => {
    // Timer to trigger smooth fade-out
    const fadeTimer = setTimeout(() => {
      setPhase("fading");
    }, durationMs);

    // Timer to finish and unmount
    const doneTimer = setTimeout(() => {
      setPhase("done");
      if (onComplete) onComplete();
    }, durationMs + 600);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [durationMs, onComplete]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let startTime = performance.now();

    const resize = () => {
      const dpr = typeof window !== "undefined" ? Math.min(window.devicePixelRatio || 2, 2) : 2;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const render = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.clearRect(0, 0, w, h);

      // Geometry: two intersecting circles
      // Responsive radius
      const R = Math.min(w * 0.16, 115);
      const offset = R * 0.58; // distance from center to each circle center (creates ~85px overlap)

      // Use screen composite mode for glowing moiré overlap
      ctx.globalCompositeOperation = "screen";

      // ── Left Circle: ~34 fine vertical bars (Electric Blue / Periwinkle) ──
      const leftPitch = 5.6;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";

      for (let x = -R + 3; x <= R - 3; x += leftPitch) {
        const chord = Math.sqrt(Math.max(0, R * R - x * x));
        // Harmonic waveform modulation
        const wave1 = Math.sin(elapsed * 3.6 + x * 0.045);
        const wave2 = Math.cos(elapsed * 2.2 - x * 0.07);
        const mod = 1 + 0.15 * wave1 + 0.08 * wave2;
        const barH = chord * mod;

        // Subtle gradient luminance across circle
        const normX = x / R;
        const alpha = Math.max(0.55, 0.95 - 0.3 * Math.abs(normX));
        ctx.strokeStyle = `rgba(79, 107, 255, ${alpha})`;

        ctx.beginPath();
        ctx.moveTo(cx - offset + x, cy - barH);
        ctx.lineTo(cx - offset + x, cy + barH);
        ctx.stroke();
      }

      // ── Right Circle: ~26 slightly wider bars (Vivid Violet / Indigo) ──
      const rightPitch = 7.4;
      ctx.lineWidth = 3.2;

      for (let x = -R + 3; x <= R - 3; x += rightPitch) {
        const chord = Math.sqrt(Math.max(0, R * R - x * x));
        // Counter-harmonic wave modulation
        const wave1 = Math.sin(elapsed * 3.2 - x * 0.05 + 1.4);
        const wave2 = Math.sin(elapsed * 4.5 + x * 0.035);
        const mod = 1 + 0.18 * wave1 + 0.09 * wave2;
        const barH = chord * mod;

        const normX = x / R;
        const alpha = Math.max(0.55, 0.95 - 0.3 * Math.abs(normX));
        ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;

        ctx.beginPath();
        ctx.moveTo(cx + offset + x, cy - barH);
        ctx.lineTo(cx + offset + x, cy + barH);
        ctx.stroke();
      }

      ctx.globalCompositeOperation = "source-over";

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  if (phase === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#050507] select-none transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        phase === "fading" ? "opacity-0 scale-[1.04] pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{
        willChange: "opacity, transform",
      }}
    >
      {/* Background ambient spotlight */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-gradient-to-r from-blue-600/15 via-purple-600/15 to-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-[320px] max-w-[600px] block"
      />

      {/* Central Brand Lockup: RelatiV + Minimalist Glyphs */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
        <div className="px-5 py-2 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.8)] flex items-center gap-3">
          {/* Logo Wordmark */}
          <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Relati<span className="text-amber-400">V</span>
          </span>

          {/* Minimalist UI Glyphs (Audio-Wordmark signature) */}
          <div className="flex items-center gap-1.5 text-zinc-400 font-mono text-xs pl-2 border-l border-white/15">
            <span className="w-1.5 h-3 border border-zinc-400/80 rounded-[1px] inline-block" />
            <span className="text-[10px] opacity-80">◐</span>
            <span className="text-[10px] opacity-80">◑</span>
            <span className="w-2 h-2 rounded-full border border-emerald-400 bg-emerald-400/30 inline-block animate-pulse" />
          </div>
        </div>
      </div>

      {/* Subtitle Tech Label */}
      <div className="absolute bottom-12 inset-x-0 flex justify-center items-center gap-2 text-[10px] font-mono tracking-[0.2em] uppercase text-zinc-500">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        <span>AI VIDEO INTELLIGENCE · ENGINE INITIALIZING</span>
      </div>
    </div>
  );
}
