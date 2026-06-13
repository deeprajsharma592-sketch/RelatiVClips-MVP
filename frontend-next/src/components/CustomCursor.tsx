"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

const SELECTORS = "a, button, [role='button'], input, textarea, [data-magnetic]";

export default function CustomCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 200, damping: 25, mass: 0.6 });
  const ringY = useSpring(y, { stiffness: 200, damping: 25, mass: 0.6 });

  const [hovering, setHovering] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [variant, setVariant] = useState<"dot" | "ring">("dot");

  useEffect(() => {
    // Skip on touch devices
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
      if (hidden) setHidden(false);
    };
    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const hit = t.closest(SELECTORS);
      setHovering(Boolean(hit));
    };
    const onDown = () => setPressed(true);
    const onUp = () => setPressed(false);
    const onLeave = () => setHidden(true);
    const onEnter = () => setHidden(false);

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseover", onOver);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
    };
  }, [x, y, hidden]);

  if (hidden) return null;

  return (
    <>
      {/* Hide native cursor on the page when our custom one is active */}
      <style jsx global>{`
        @media (hover: hover) and (pointer: fine) {
          html.has-custom-cursor,
          html.has-custom-cursor *:not(input):not(textarea):not([contenteditable]) {
            cursor: none !important;
          }
        }
      `}</style>
      <style jsx global>{`html { --custom-cursor-on: 1; }`}</style>

      {/* Outer ring — large, follows with spring */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[9998]"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
        }}
      >
        <motion.div
          className="rounded-full border"
          style={{
            borderColor: "rgba(217, 70, 239, 0.40)",
            background: "transparent",
          }}
          animate={{
            width: hovering ? (pressed ? 18 : 36) : 28,
            height: hovering ? (pressed ? 18 : 36) : 28,
            borderColor: hovering
              ? "rgba(217, 70, 239, 0.85)"
              : "rgba(217, 70, 239, 0.30)",
            background: hovering ? "rgba(217, 70, 239, 0.10)" : "transparent",
          }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
        />
      </motion.div>

      {/* Inner dot — small, follows instantly */}
      <motion.div
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-[9999]"
        style={{
          x,
          y,
          translateX: "-50%",
          translateY: "-50%",
        }}
      >
        <motion.div
          className="rounded-full"
          style={{
            background: "var(--color-accent)",
            boxShadow: "0 0 8px rgba(217, 70, 239, 0.6)",
          }}
          animate={{
            width: hovering ? 0 : 6,
            height: hovering ? 0 : 6,
            opacity: hovering ? 0 : 1,
          }}
          transition={{ duration: 0.15 }}
        />
      </motion.div>
    </>
  );
}
