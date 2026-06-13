"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";

interface TextScrambleProps {
  text: string;
  className?: string;
  /** Charset to scramble through. Default: uppercase + lowercase + digits + symbols */
  charset?: string;
  /** Frames per scramble step (lower = faster). Default: 2 */
  speed?: number;
  /** Hover-only? Default: true. If false, scrambles on mount once. */
  triggerOnHover?: boolean;
  as?: keyof React.JSX.IntrinsicElements;
}

const DEFAULT_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";

/**
 * Text that cycles through random characters and "settles" into the real string.
 * On hover (or once on mount), each character becomes a random char that
 * resolves to its final value with a per-char stagger. Premium, subtle, designer.
 */
export default function TextScramble({
  text,
  className = "",
  charset = DEFAULT_CHARSET,
  speed = 2,
  triggerOnHover = true,
  as: Tag = "span",
}: TextScrambleProps) {
  const [display, setDisplay] = useState(text);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  const scramble = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const duration = 600 + text.length * 30;
    const queue: { from: string; to: string; start: number; end: number; char?: string }[] = [];

    for (let i = 0; i < text.length; i++) {
      const from = text[i];
      const to = text[i];
      const start = 80 * i;
      const end = start + 300 + Math.random() * 200;
      if (!queue[i]) queue[i] = { from, to, start, end };
      queue[i].from = from;
      queue[i].to = to;
      queue[i].start = start;
      queue[i].end = end;
    }

    const frame = (now: number) => {
      let output = "";
      let complete = 0;
      for (let i = 0; i < text.length; i++) {
        const q = queue[i];
        if (!q) { output += text[i]; continue; }
        if (now >= q.end) {
          complete++;
          output += q.to;
        } else if (now >= q.start) {
          if (!q.char || Math.random() < 0.28) {
            q.char = charset[Math.floor(Math.random() * charset.length)];
          }
          output += q.char;
        } else {
          output += text[i];
        }
      }
      setDisplay(output);
      if (complete < text.length) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setDisplay(text);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [text, charset]);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (!triggerOnHover) scramble();
  }, [scramble, triggerOnHover]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const handleEnter = () => {
    if (triggerOnHover) scramble();
  };

  const MotionTag = motion[Tag as "span"] as any;
  return (
    <MotionTag
      className={className}
      onMouseEnter={handleEnter}
      style={{ display: "inline-block" }}
    >
      {display}
    </MotionTag>
  );
}
