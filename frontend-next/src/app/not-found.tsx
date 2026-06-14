"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-24 flex flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <span className="text-sm font-mono" style={{ color: "var(--color-accent)" }}>
          [ Φ-404 ]
        </span>
        <h1
          className="font-display font-bold mt-4 mb-2"
          style={{
            fontSize: "clamp(4rem, 12vw, 9rem)",
            lineHeight: 1,
            background: "linear-gradient(135deg, #FF77E9 0%, #FFD24D 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          404
        </h1>
        <p className="text-lg mb-2" style={{ color: "var(--color-text-secondary)" }}>
          Signal not found. This page does not exist.
        </p>
        <p
          className="text-sm font-mono mb-8"
          style={{ color: "var(--color-text-muted)" }}
        >
          [∅] The requested resource could not be located in the pipeline.
        </p>
        <Link
          href="/"
          className="btn-gold inline-flex items-center gap-2"
        >
          ← Return to Workspace
        </Link>
      </motion.div>
    </div>
  );
}
