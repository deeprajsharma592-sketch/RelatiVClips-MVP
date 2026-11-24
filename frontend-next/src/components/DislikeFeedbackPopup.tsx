"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, MessageSquare } from "lucide-react";

export interface DislikeFeedbackData {
  reason_codes: string[];
  reason_other_text?: string;
}

interface DislikeFeedbackPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DislikeFeedbackData) => void;
  initialTimerSeconds?: number;
}

const REASON_OPTIONS = [
  { id: "hook_bad", label: "Hook is not good" },
  { id: "face_track_bad", label: "Face not tracked well" },
  { id: "no_context", label: "Wrong moment / no context" },
  { id: "captions_bad", label: "Captions are off" },
  { id: "length_bad", label: "Too long / too short" },
  { id: "other", label: "Other" },
];

export default function DislikeFeedbackPopup({
  isOpen,
  onClose,
  onSubmit,
  initialTimerSeconds = 5,
}: DislikeFeedbackPopupProps) {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [otherText, setOtherText] = useState("");
  const [timeLeftMs, setTimeLeftMs] = useState(initialTimerSeconds * 1000);
  const [isTyping, setIsTyping] = useState(false);

  const totalDurationMs = initialTimerSeconds * 1000;
  const isTypingRef = useRef(isTyping);
  isTypingRef.current = isTyping;

  const selectedCodesRef = useRef(selectedCodes);
  selectedCodesRef.current = selectedCodes;

  const otherTextRef = useRef(otherText);
  otherTextRef.current = otherText;

  // Reset state when popup opens
  useEffect(() => {
    if (isOpen) {
      setSelectedCodes([]);
      setOtherText("");
      setTimeLeftMs(totalDurationMs);
      setIsTyping(false);
    }
  }, [isOpen, totalDurationMs]);

  // Countdown timer with active pause/extension when user is typing in "Other"
  useEffect(() => {
    if (!isOpen) return;

    const interval = 100; // tick every 100ms
    const timer = setInterval(() => {
      // Pause countdown while user is typing in "Other"
      if (isTypingRef.current) {
        return;
      }

      setTimeLeftMs((prev) => {
        if (prev <= interval) {
          clearInterval(timer);
          // Auto-close on timeout saves dislike without blocking
          onSubmit({
            reason_codes: selectedCodesRef.current,
            reason_other_text: otherTextRef.current ? otherTextRef.current.slice(0, 280) : undefined,
          });
          onClose();
          return 0;
        }
        return prev - interval;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [isOpen, onClose, onSubmit]);

  const toggleReason = (id: string) => {
    setSelectedCodes((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      return next;
    });

    // If selecting "Other", give extra time
    if (id === "other") {
      setTimeLeftMs((prev) => Math.max(prev, 8000));
    }
  };

  const handleManualSubmit = () => {
    onSubmit({
      reason_codes: selectedCodes,
      reason_other_text: otherText.trim() ? otherText.trim().slice(0, 280) : undefined,
    });
    onClose();
  };

  const progressPercent = Math.max(0, Math.min(100, (timeLeftMs / totalDurationMs) * 100));

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="absolute z-50 left-0 top-12 w-80 sm:w-96 bg-[#16161a] border border-white/15 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] text-white font-sans p-4 select-none backdrop-blur-md"
      >
        {/* Countdown Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 rounded-t-xl overflow-hidden">
          <motion.div
            className={`h-full transition-all duration-100 ${
              isTyping ? "bg-amber-400" : "bg-emerald-500"
            }`}
            style={{ width: isTyping ? "100%" : `${progressPercent}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">Why didn't this clip work?</span>
            {isTyping ? (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                Timer Paused
              </span>
            ) : (
              <span className="text-[11px] font-mono text-zinc-400">
                {Math.ceil(timeLeftMs / 1000)}s
              </span>
            )}
          </div>
          <button
            onClick={() => {
              // Auto-dismiss saves without reasons
              onSubmit({ reason_codes: [] });
              onClose();
            }}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition"
            title="Dismiss popup"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Reason Chips (Multi-select) */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {REASON_OPTIONS.map((opt) => {
            const isSelected = selectedCodes.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggleReason(opt.id)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-medium shadow-[0_0_8px_rgba(16,185,129,0.2)]"
                    : "bg-white/5 border-white/10 text-zinc-300 hover:border-white/25 hover:text-white"
                }`}
              >
                {isSelected && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* "Other" text input when selected */}
        {selectedCodes.includes("other") && (
          <div className="mb-3">
            <div className="relative">
              <textarea
                value={otherText}
                maxLength={280}
                placeholder="Briefly tell us what felt off (max 280 chars)..."
                onChange={(e) => {
                  setOtherText(e.target.value);
                  setIsTyping(true);
                }}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                rows={2}
                className="w-full text-xs bg-black/50 border border-white/20 focus:border-emerald-500 rounded-lg p-2 text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-none transition"
              />
              <span className="absolute bottom-1.5 right-2 text-[10px] font-mono text-zinc-500">
                {otherText.length}/280
              </span>
            </div>
          </div>
        )}

        {/* Submit Button (saves immediately on tap) */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-zinc-500">Auto-saves on timeout</span>
          <button
            type="button"
            onClick={handleManualSubmit}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition cursor-pointer shadow-sm flex items-center gap-1"
          >
            <span>Submit</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
