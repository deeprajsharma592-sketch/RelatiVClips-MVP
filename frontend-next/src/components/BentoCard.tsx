"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface BentoCardProps {
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  children: ReactNode;
  glow?: "accent" | "secondary" | "none";
  variant?: "glass" | "solid";
}

export default function BentoCard({
  colSpan = 4,
  rowSpan = 1,
  className = "",
  children,
  glow = "none",
  variant = "glass",
}: BentoCardProps) {
  return (
    <motion.div
      className={`${variant === "glass" ? "bento-card" : "bento-card-solid"} p-6 ${glow === "accent" ? "glow-accent" : glow === "secondary" ? "glow-secondary" : ""} ${className}`}
      style={{
        gridColumn: `span ${colSpan}`,
        gridRow: `span ${rowSpan}`,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
