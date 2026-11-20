"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";

/**
 * A light 3D cylinder turn shared by the homepage sections. The page keeps its
 * normal document flow; each section bends into view as the visitor scrolls.
 */
export default function CylinderScrollReveal({ children }: { children: ReactNode }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 28, mass: 0.35 });
  const rotateX = useTransform(progress, [0, 0.5, 1], [8, 0, -8]);
  const translateY = useTransform(progress, [0, 0.5, 1], [28, 0, -28]);
  const opacity = useTransform(progress, [0, 0.18, 0.82, 1], [0.65, 1, 1, 0.78]);

  return (
    <div ref={sectionRef} className="relative [perspective:1400px]">
      <motion.div
        style={reduceMotion ? undefined : { rotateX, y: translateY, opacity, transformOrigin: "center center" }}
        className="relative [transform-style:preserve-3d] [backface-visibility:hidden]"
      >
        {children}
      </motion.div>
    </div>
  );
}
