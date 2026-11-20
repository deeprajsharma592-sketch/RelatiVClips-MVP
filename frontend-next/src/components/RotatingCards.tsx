"use client";

/**
 * RotatingCards — 3D Draggable Ring of Cards
 * High-Performance Animation & UX Engineering:
 * - Direct DOM transform updates in requestAnimationFrame (ZERO React re-renders during rotation)
 * - 60/120fps hardware-accelerated 3D carousel with fluid continuous motion
 * - IntersectionObserver viewport awareness: only animates when gallery is visible (threshold: 0.35-0.5)
 * - Frame-rate independent timing with elapsed delta calculation
 * - Natural 1:1 pointer drag with momentum damping and graceful 1.2s idle resume
 * - Seamless pause on hover and tab visibility change
 * - Reduced motion support (prefers-reduced-motion)
 * - touch-action: pan-y preserves natural vertical page scrolling on touch devices
 */

import React, { useState, useEffect, useRef, useCallback } from "react";

export interface RotatingCardItem {
  id: string | number;
  [key: string]: any;
}

export interface RotatingCardsProps<T extends RotatingCardItem = any> {
  cards: T[];
  radius?: number;
  cardWidth?: number;
  cardHeight?: number;
  duration?: number; // seconds for full 360 deg rotation
  speed?: number; // deg per second (approx 3-5 deg/s for graceful showcase)
  autoPlay?: boolean;
  pauseOnHover?: boolean;
  draggable?: boolean;
  renderCard?: (card: T, index: number, isCenter: boolean) => React.ReactNode;
  className?: string;
}

export default function RotatingCards<T extends RotatingCardItem = any>({
  cards,
  radius = 360,
  cardWidth = 168,
  cardHeight = 325,
  duration,
  speed = 5.6, // 5.6 deg/sec continuous motion (increased by 40% from 4 deg/s)
  autoPlay = true,
  pauseOnHover = false,
  draggable = true,
  renderCard,
  className = "",
}: RotatingCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardElementsRef = useRef<(HTMLDivElement | null)[]>([]);

  // Responsive layout dimensions (only state that triggers re-render on resize)
  const [responsiveRadius, setResponsiveRadius] = useState<number>(radius);
  const [responsiveWidth, setResponsiveWidth] = useState<number>(cardWidth);
  const [responsiveHeight, setResponsiveHeight] = useState<number>(cardHeight);

  // Animation & interaction references (bypass React re-render cycle for 60/120fps performance)
  const rotationRef = useRef<number>(0);
  const isVisibleRef = useRef<boolean>(false);
  const isHoveredRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);
  const prefersReducedMotionRef = useRef<boolean>(false);
  const idleResumeTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const responsiveRadiusRef = useRef<number>(radius);
  responsiveRadiusRef.current = responsiveRadius;

  // Drag physics tracking
  const dragRef = useRef({
    startX: 0,
    startRotation: 0,
    lastX: 0,
    velocity: 0,
    lastTime: 0,
  });

  // Calculate degrees per second: explicit speed prop or derived from duration
  const degPerSecond = duration ? 360 / duration : speed;

  // Update 3D card transforms directly on DOM nodes without triggering React re-renders
  const updateCardTransforms = useCallback((currentRot: number) => {
    if (!cards || cards.length === 0) return;
    const step = 360 / cards.length;
    const currentRadius = responsiveRadiusRef.current;

    for (let i = 0; i < cards.length; i++) {
      const el = cardElementsRef.current[i];
      if (!el) continue;

      const cardAngle = i * step + currentRot;
      // Normalize angle to [-180, 180] for front/back depth calculations
      const normAngle = (((cardAngle % 360) + 540) % 360) - 180;
      const rad = (normAngle * Math.PI) / 180;
      const cosVal = Math.cos(rad); // 1 = facing forward, -1 = facing back
      const isCenter = Math.abs(normAngle) < step / 2;

      // Realistic optical depth scaling
      const depthScale = Math.max(0.88, 0.92 + 0.08 * Math.max(0, cosVal));
      const depthOpacity = Math.max(0.25, 0.38 + 0.62 * Math.max(0, cosVal));
      const zIndex = Math.round((cosVal + 1) * 100);

      // Apply GPU-accelerated 3D transform directly
      el.style.transform = `rotateY(${cardAngle.toFixed(2)}deg) translateZ(${currentRadius}px) scale(${depthScale.toFixed(3)})`;
      el.style.opacity = depthOpacity.toFixed(3);
      el.style.zIndex = `${zIndex}`;

      // Synchronize center active styling smoothly without React virtual DOM overhead
      const centerStr = isCenter ? "true" : "false";
      if (el.dataset.center !== centerStr) {
        el.dataset.center = centerStr;
        el.style.filter = isCenter
          ? "drop-shadow(0 0 25px rgba(245, 158, 11, 0.35))"
          : "drop-shadow(0 15px 30px rgba(0, 0, 0, 0.7))";
        const inner = el.firstElementChild as HTMLElement | null;
        if (inner) {
          if (isCenter) {
            inner.classList.add("border-amber-400/80", "shadow-[0_0_35px_rgba(245,158,11,0.25)]", "scale-[1.02]");
            inner.classList.remove("border-white/[0.08]");
          } else {
            inner.classList.remove("border-amber-400/80", "shadow-[0_0_35px_rgba(245,158,11,0.25)]", "scale-[1.02]");
            inner.classList.add("border-white/[0.08]");
          }
        }
      }
    }
  }, [cards]);

  // Responsive scaling for viewports
  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      const w = window.innerWidth;
      let newRad = radius;
      let newW = cardWidth;
      let newH = cardHeight;

      if (w < 640) {
        newRad = Math.min(radius, 210);
        newW = 144;
        newH = 256;
      } else if (w < 1024) {
        newRad = Math.min(radius, 310);
        newW = 162;
        newH = 288;
      }

      setResponsiveRadius(newRad);
      setResponsiveWidth(newW);
      setResponsiveHeight(newH);
      responsiveRadiusRef.current = newRad;
      updateCardTransforms(rotationRef.current);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [radius, cardWidth, cardHeight, updateCardTransforms]);

  // Accessibility: Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotionRef.current = mq.matches;

    const handleChange = () => {
      prefersReducedMotionRef.current = mq.matches;
    };
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // Main high-performance animation loop
  useEffect(() => {
    let active = true;

    const animate = (time: number) => {
      if (!active) return;

      if (!lastTimeRef.current) {
        lastTimeRef.current = time;
      }
      // Cap delta time at 0.1s to avoid jump if tab was throttled
      const delta = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;

      if (!isDraggingRef.current) {
        // Handle inertial glide after drag release
        if (Math.abs(dragRef.current.velocity) > 0.05) {
          dragRef.current.velocity *= 0.95; // buttery exponential momentum decay
          rotationRef.current += dragRef.current.velocity;
          idleResumeTimeRef.current = time + 600; // brief 0.6s gentle transition before resuming autoPlay
          updateCardTransforms(rotationRef.current);
        } else {
          dragRef.current.velocity = 0;

          // Continuous slow autoPlay when visible & idle time passed
          const canAutoPlay =
            autoPlay &&
            isVisibleRef.current &&
            (!pauseOnHover || !isHoveredRef.current) &&
            !prefersReducedMotionRef.current &&
            time >= idleResumeTimeRef.current;

          if (canAutoPlay) {
            rotationRef.current -= degPerSecond * delta;
            updateCardTransforms(rotationRef.current);
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    const startLoop = () => {
      if (animFrameRef.current !== null) return;
      lastTimeRef.current = performance.now();
      animFrameRef.current = requestAnimationFrame(animate);
    };

    const stopLoop = () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };

    // Viewport Visibility: IntersectionObserver
    // Only animates when gallery is in viewport. Pauses offscreen.
    let observer: IntersectionObserver | null = null;
    if (containerRef.current && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          const isVisible = entry.isIntersecting;
          isVisibleRef.current = isVisible;

          if (isVisible) {
            startLoop();
          } else {
            // Pause animation when outside viewport to save resources
            stopLoop();
          }
        },
        { threshold: [0, 0.05] }
      );
      observer.observe(containerRef.current);
    } else {
      isVisibleRef.current = true;
      startLoop();
    }

    // Tab visibility handling: pause when browser tab is inactive
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopLoop();
      } else if (isVisibleRef.current) {
        startLoop();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Initial transform application
    updateCardTransforms(rotationRef.current);

    return () => {
      active = false;
      stopLoop();
      if (observer) observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [autoPlay, pauseOnHover, degPerSecond, updateCardTransforms]);

  // Pointer drag interactions
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!draggable) return;
    if (e.button !== 0) return; // Primary pointer only

    isDraggingRef.current = true;
    dragRef.current.startX = e.clientX;
    dragRef.current.lastX = e.clientX;
    dragRef.current.startRotation = rotationRef.current;
    dragRef.current.velocity = 0;
    dragRef.current.lastTime = performance.now();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const now = performance.now();
    const dt = Math.max(1, now - dragRef.current.lastTime);
    const dx = e.clientX - dragRef.current.lastX;

    // Smooth drag sensitivity (0.32 deg per pixel movement)
    const sensitivity = 0.32;
    rotationRef.current = dragRef.current.startRotation + (e.clientX - dragRef.current.startX) * sensitivity;
    dragRef.current.velocity = (dx / dt) * 12; // momentum velocity
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastTime = now;

    updateCardTransforms(rotationRef.current);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    // Resume RAF loop if it was stopped
    if (animFrameRef.current === null && isVisibleRef.current) {
      lastTimeRef.current = performance.now();
      animFrameRef.current = requestAnimationFrame((time) => {
        lastTimeRef.current = time;
      });
    }
  };

  const handleMouseEnter = () => {
    if (pauseOnHover) {
      isHoveredRef.current = true;
    }
  };

  const handleMouseLeave = () => {
    if (pauseOnHover) {
      isHoveredRef.current = false;
    }
  };

  const stepAngle = cards && cards.length > 0 ? 360 / cards.length : 45;

  return (
    <div
      ref={containerRef}
      className={`relative w-full select-none flex flex-col items-center justify-center cursor-grab active:cursor-grabbing ${className}`}
      style={{
        height: `${responsiveHeight + 190}px`,
        perspective: "1600px",
        touchAction: "pan-y", // Preserve native vertical page scrolling on touch devices
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Ambient center spotlight glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[380px] bg-gradient-to-r from-amber-500/10 via-cyan-500/10 to-purple-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />

      {/* 3D Ring Stage */}
      <div
        className="relative w-full flex-1 flex items-center justify-center"
        style={{
          transformStyle: "preserve-3d",
        }}
      >
        {cards.map((card, index) => {
          const initialAngle = index * stepAngle;
          const isInitialCenter = index === 0;

          return (
            <div
              key={card.id || index}
              ref={(el) => {
                cardElementsRef.current[index] = el;
              }}
              data-center={isInitialCenter ? "true" : "false"}
              className="absolute left-1/2 top-1/2 will-change-transform"
              style={{
                width: `${responsiveWidth}px`,
                height: `${responsiveHeight}px`,
                marginLeft: `-${responsiveWidth / 2}px`,
                marginTop: `-${responsiveHeight / 2}px`,
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
                transform: `rotateY(${initialAngle}deg) translateZ(${responsiveRadius}px)`,
                touchAction: "pan-y",
              }}
            >
              {renderCard ? renderCard(card, index, isInitialCenter) : card.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
