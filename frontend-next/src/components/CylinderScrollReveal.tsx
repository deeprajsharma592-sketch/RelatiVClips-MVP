"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";

/** Scrolls each page panel across the front of one shared 3D cylinder. */
export default function CylinderScrollReveal({ children }: { children: ReactNode }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 28, mass: 0.35 });
  const rotateX = useTransform(progress, [0, 0.5, 1], [15, 0, -15]);
  const translateY = useTransform(progress, [0, 0.5, 1], [38, 0, -38]);
  const translateZ = useTransform(progress, [0, 0.5, 1], [-72, 0, -72]);
  const scale = useTransform(progress, [0, 0.5, 1], [0.97, 1, 0.97]);
  const opacity = useTransform(progress, [0, 0.18, 0.82, 1], [0.8, 1, 1, 0.8]);

  return (
    <div ref={sectionRef} className="relative [perspective:1000px]">
      <motion.div
        style={reduceMotion ? undefined : { rotateX, y: translateY, z: translateZ, scale, opacity, transformOrigin: "center center" }}
        className="relative [transform-style:preserve-3d] [backface-visibility:hidden]"
      >
        {children}
      </motion.div>
    </div>
  );
}
