"use client";

import { motion } from "framer-motion";

interface PhysicsIconProps {
  symbol: string;
  label?: string;
  value?: string | number;
  className?: string;
  color?: "secondary" | "accent";
}

export default function PhysicsIcon({
  symbol,
  label,
  value,
  className = "",
  color = "secondary",
}: PhysicsIconProps) {
  const accentColor = color === "secondary" ? "#FFD166" : "#FF6B35";

  return (
    <motion.div
      className={`inline-flex items-center gap-2 ${className}`}
      whileHover={{ scale: 1.05 }}
      transition={{ type: "spring", stiffness: 400, damping: 10 }}
    >
      <motion.span
        className="physics-var text-sm cursor-default"
        style={{ color: accentColor }}
        whileHover={{
          textShadow: `0 0 12px ${accentColor}80`,
          color: "#FFD166",
        }}
      >
        [{symbol}]
      </motion.span>
      {label && (
        <span className="text-xs text-text-muted font-sans">{label}</span>
      )}
      {value !== undefined && (
        <span className="text-xs font-mono text-white">{value}</span>
      )}
    </motion.div>
  );
}
