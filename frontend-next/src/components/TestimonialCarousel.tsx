"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Testimonial {
  quote: string;
  author: string;
  title: string;
  metric: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote: "Cut our clipping time from days to minutes. The AI actually understands which moments matter.",
    author: "Alex Chen",
    title: "Content Creator, 2.4M subs",
    metric: "10x faster",
  },
  {
    quote: "Zero data ever leaves my machine. For our compliance-heavy workflow, that's non-negotiable.",
    author: "Sarah Mitchell",
    title: "Head of Video, Fintech Co.",
    metric: "100% private",
  },
  {
    quote: "The face tracking alone saves us hours of manual centering. Every clip is perfectly framed.",
    author: "Marcus Webb",
    title: "Podcast Producer",
    metric: "85% less editing",
  },
  {
    quote: "We went from 3 clips/week to 20+/day. Our Shorts channel grew 400% in one month.",
    author: "Priya Sharma",
    title: "Social Media Director",
    metric: "400% growth",
  },
];

export default function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % TESTIMONIALS.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const t = TESTIMONIALS[current];

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="text-center max-w-2xl mx-auto"
        >
          <span className="text-3xl text-accent/30 font-serif leading-none">&ldquo;</span>
          <p className="text-lg md:text-xl text-white font-sans leading-relaxed -mt-2">
            {t.quote}
          </p>
          <span className="text-3xl text-accent/30 font-serif leading-none block -mt-1">&rdquo;</span>

          <div className="mt-6 flex items-center justify-center gap-4">
            <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
              <span className="font-mono text-xs text-accent">{t.author.charAt(0)}</span>
            </div>
            <div className="text-left">
              <p className="text-sm font-sans text-white">{t.author}</p>
              <p className="text-xs text-text-muted">{t.title}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <span className="font-mono text-xs text-accent-secondary">{t.metric}</span>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Dots */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {TESTIMONIALS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              i === current ? "bg-accent w-6" : "bg-border hover:bg-text-muted"
            }`}
            aria-label={`Go to testimonial ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
