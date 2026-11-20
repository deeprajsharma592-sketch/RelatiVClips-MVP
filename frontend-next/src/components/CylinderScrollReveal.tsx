"use client";

import { useRef, type ReactNode } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";

/** Rolls each page panel around a cylinder as it moves through the viewport. */
export default function CylinderScrollReveal({ children }: { children: ReactNode }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start end", "end start"] });
  const progress = useSpring(scrollYProgress, { stiffness: 85, damping: 24, mass: 0.45 });

  // Each section is a face on the cylinder: it turns toward the viewer at the
  // center of the viewport, then rolls away as the page continues to scroll.
  const rotateX = useTransform(progress, [0, 0.5, 1], [42, 0, -42]);
  const translateY = useTransform(progress, [0, 0.5, 1], [84, 0, -84]);
  const translateZ = useTransform(progress, [0, 0.5, 1], [-180, 0, -180]);
  const scale = useTransform(progress, [0, 0.5, 1], [0.9, 1, 0.9]);
  const opacity = useTransform(progress, [0, 0.12, 0.88, 1], [0.55, 1, 1, 0.55]);

  return (
    <div ref={sectionRef} className="relative [perspective:900px]">
      <motion.div
        style={reduceMotion ? undefined : { rotateX, y: translateY, z: translateZ, scale, opacity, transformOrigin: "center center", willChange: "transform, opacity" }}
        className="relative [transform-style:preserve-3d] [backface-visibility:hidden]"
      >
        {children}
      </motion.div>
    </div>
  );
}
