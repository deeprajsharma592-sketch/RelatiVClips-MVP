"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function PressCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
      style={{
        background: copied ? "rgba(16, 185, 129, 0.12)" : "rgba(40, 30, 15, 0.05)",
        color: copied ? "var(--color-success)" : "var(--color-text-muted)",
      }}
      aria-label={`Copy ${text}`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
