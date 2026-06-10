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
        <span className="text-sm font-mono text-accent">[ \u03A6-404 ]</span>
        <h1 className="text-6xl md:text-8xl font-display font-bold text-white mt-4 mb-2">
          <span className="bg-gradient-to-r from-accent to-accent-secondary bg-clip-text text-transparent">
            404
          </span>
        </h1>
        <p className="text-lg text-text-muted font-sans mb-2">
          Signal not found. This page does not exist.
        </p>
        <p className="text-sm text-text-muted/60 font-mono mb-8">
          [\u2205] The requested resource could not be located in the pipeline.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white text-sm font-semibold rounded-[4px] font-sans hover:shadow-lg hover:shadow-accent/20 transition-all"
        >
          \u2190 Return to Workspace
        </Link>
      </motion.div>
    </div>
  );
}
