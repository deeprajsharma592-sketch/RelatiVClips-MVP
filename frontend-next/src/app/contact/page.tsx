"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import BentoCard from "@/components/BentoCard";
import PhysicsIcon from "@/components/PhysicsIcon";
import { apiPath } from "@/lib/apiBase";

export default function ContactPage() {
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!email.trim() || !subject.trim() || !message.trim()) {
      setError("All fields are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setError(null);
    setSending(true);
    try {
      const res = await fetch(apiPath("/contact"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, subject, message }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      setSent(true);
      setEmail("");
      setSubject("");
      setMessage("");
    } catch {
      setError("Could not send message. Please try again later.");
    } finally {
      setSending(false);
    }
  }, [email, subject, message]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-16">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="text-sm font-mono text-accent">
            [Φ-Support]
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-accent to-transparent" />
        </div>
        <h1 className="text-4xl font-display font-bold text-white mb-3">
          Contact <span className="text-accent">Support</span>
        </h1>
        <p className="text-base text-text-muted max-w-2xl font-sans">
          Reach our engineering team. We respond within 24 hours.
        </p>
      </motion.div>

      <div className="bento-grid">
        <BentoCard colSpan={7} glow="accent">
          <div className="space-y-6">
            <h2 className="text-lg font-display font-bold text-white">
              Send a Message
            </h2>

            <AnimatePresence>
              {sent && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-accent-secondary/10 border border-accent-secondary/20 rounded-[4px]"
                >
                  <span className="text-sm text-accent-secondary font-sans">Message sent successfully. We&apos;ll respond within 24 hours.</span>
                </motion.div>
              )}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-3 bg-error/10 border border-error/20 rounded-[4px]"
                >
                  <span className="text-sm text-error font-sans">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-text-muted mb-2">
                  [ε] Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={sending || sent}
                  className="w-full bg-bg-base border border-border rounded-[4px] px-4 py-3 text-sm text-text-primary placeholder-text-muted/40 font-sans input-glow transition-all disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-text-muted mb-2">
                  [φ] Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What can we help with?"
                  disabled={sending || sent}
                  className="w-full bg-bg-base border border-border rounded-[4px] px-4 py-3 text-sm text-text-primary placeholder-text-muted/40 font-sans input-glow transition-all disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-text-muted mb-2">
                  [Δv] Message
                </label>
                <textarea
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Describe your issue or question..."
                  disabled={sending || sent}
                  className="w-full bg-bg-base border border-border rounded-[4px] px-4 py-3 text-sm text-text-primary placeholder-text-muted/40 font-sans input-glow transition-all resize-none disabled:opacity-40"
                />
              </div>

              <div className="flex gap-3">
                <motion.button
                  onClick={handleSubmit}
                  disabled={sending || sent}
                  className="px-6 py-3 bg-accent text-white text-sm font-semibold rounded-[4px] font-sans disabled:opacity-30"
                  whileHover={!sending && !sent ? { scale: 1.02, boxShadow: "0 0 20px rgba(77,77,255,0.3)" } : {}}
                  whileTap={!sending && !sent ? { scale: 0.98 } : {}}
                >
                  {sending ? "Sending..." : sent ? "Sent ✓" : "Send Message [Φ]"}
                </motion.button>
                {sent && (
                  <motion.button
                    onClick={() => setSent(false)}
                    className="px-4 py-3 bg-transparent border border-border text-text-muted text-sm rounded-[4px] font-sans hover:text-white transition-colors"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    Send Another
                  </motion.button>
                )}
              </div>
            </div>
          </div>
        </BentoCard>

        <BentoCard colSpan={5} glow="secondary">
          <div className="space-y-6">
            <h2 className="text-lg font-display font-bold text-white">
              Contact Info
            </h2>

            <div className="space-y-4">
              {[
                {
                  symbol: "η",
                  label: "Email",
                  value: "engineering@relativ.dev",
                },
                {
                  symbol: "Σ",
                  label: "Response Time",
                  value: "< 24 hours",
                },
                {
                  symbol: "ε",
                  label: "Status",
                  value: "All systems nominal",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-3 bg-bg-base border border-border rounded-[4px]"
                >
                  <PhysicsIcon symbol={item.symbol} label={item.label} />
                  <p className="mt-2 text-sm font-mono text-text-primary">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
