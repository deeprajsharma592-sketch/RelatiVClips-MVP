"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Key,
  Terminal,
  Webhook,
  Cpu,
  Zap,
  ShieldCheck,
  ArrowLeft,
  ArrowUpRight,
  Copy,
  Check,
  Layers,
  Workflow,
  Server,
} from "lucide-react";

type CodeTab = "curl" | "node" | "python" | "webhook";

const CODE_SNIPPETS: Record<CodeTab, { label: string; code: string }> = {
  curl: {
    label: "cURL",
    code: `curl -X POST https://api.relativclips.com/api/v1/youtube \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "clip_count": 5,
    "min_duration": 30,
    "max_duration": 90,
    "caption_style": "bold_karaoke",
    "webhook_url": "https://your-app.com/webhooks/relativ"
  }'`,
  },
  node: {
    label: "Node / TypeScript",
    code: `const res = await fetch("https://api.relativclips.com/api/v1/youtube", {
  method: "POST",
  headers: {
    "Authorization": \`Bearer \${process.env.RELATIV_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    clip_count: 5,
    min_duration: 30,
    max_duration: 90,
    webhook_url: "https://your-app.com/webhooks/relativ",
  }),
});

const { task_id, status } = await res.json();
console.log("Queued job:", task_id, status);`,
  },
  python: {
    label: "Python",
    code: `import os, requests

resp = requests.post(
    "https://api.relativclips.com/api/v1/youtube",
    headers={"Authorization": f"Bearer {os.environ['RELATIV_API_KEY']}"},
    json={
        "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "clip_count": 5,
        "min_duration": 30,
        "max_duration": 90,
        "webhook_url": "https://your-app.com/webhooks/relativ",
    },
    timeout=30,
)
resp.raise_for_status()
print(resp.json())`,
  },
  webhook: {
    label: "Webhook Payload",
    code: `{
  "event": "task.completed",
  "task_id": "tsk_9f8a2b1c",
  "source_duration_s": 2410,
  "clips": [
    {
      "clip_id": "clp_01hxy7z",
      "viral_title": "Why 90% of founders miss their first distribution window",
      "duration_s": 54.2,
      "story_score": 92,
      "download_url": "https://cdn.relativclips.com/outputs/clp_01hxy7z.mp4",
      "transcript": "..."
    }
  ]
}`,
  },
};

const PAYG_RATES = [
  {
    item: "Source Ingestion & AI Analysis",
    unit: "Per source minute",
    price: "$0.04 / min",
    detail: "Audio energy curve, word-level Whisper transcription, and narrative arc detection.",
  },
  {
    item: "9:16 Face-Tracked Clip Render",
    unit: "Per rendered clip",
    price: "$0.12 / clip",
    detail: "Active speaker reframing, 1080×1920 H.264 render, and designer word-by-word captions.",
  },
  {
    item: "Preference Feedback & Ranking Loop",
    unit: "Per event",
    price: "Included",
    detail: "Log likes, downloads, and dislike reasons via API to personalize future clip selection.",
  },
];

const ENTERPRISE_PATTERNS = [
  {
    icon: Webhook,
    title: "Event-Driven DAM & CMS Ingestion",
    body: "Connect webhooks directly to S3, Cloudflare R2, Frame.io, or your internal CMS. Finished MP4s, thumbnails, and JSON word timestamps arrive automatically without polling.",
  },
  {
    icon: Workflow,
    title: "Works With Any Automation Stack",
    body: "Trigger clipping jobs from n8n, Zapier, Make, Python Celery workers, or Node queues whenever a podcast episode, webinar, or YouTube stream finishes recording.",
  },
  {
    icon: Cpu,
    title: "Dedicated GPU Lanes & Burst Concurrency",
    body: "Enterprise Pay-As-You-Go accounts scale horizontally across isolated GPU workers—processing dozens of 60-minute episodes simultaneously with predictable latency.",
  },
  {
    icon: Layers,
    title: "Programmatic Brand Kits & Creator Taste",
    body: "Pass custom caption styles, tail-buffer padding, and creator preference IDs per request so every automated output matches your channel's exact visual identity.",
  },
];

export default function ApiAccessPage() {
  const [activeTab, setActiveTab] = useState<CodeTab>("curl");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CODE_SNIPPETS[activeTab].code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0B0E] text-[#F4F1E8] pt-28 pb-24">
      <div className="mx-auto max-w-6xl px-6">
        {/* Back to Studio */}
        <div className="mb-10 flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#141517] px-3.5 py-2 text-xs text-[#b6b7bc] transition hover:border-white/20 hover:text-white"
          >
            <ArrowLeft size={14} />
            Back to Studio
          </Link>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#67D8DF]/30 bg-[#67D8DF]/10 px-3 py-1 font-mono text-[11px] text-[#67D8DF]">
            <Key size={12} />
            Pay-As-You-Go API Tier
          </span>
        </div>

        {/* Hero */}
        <section className="grid gap-10 lg:grid-cols-12 lg:items-end border-b border-white/10 pb-14">
          <div className="lg:col-span-7">
            <h1 className="font-display text-4xl font-semibold tracking-tight text-[#F4F1E8] sm:text-5xl lg:text-6xl leading-[1.03]">
              Clip videos programmatically from any tool or pipeline.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#a8a9af] sm:text-lg">
              The RelatiV API exposes our entire narrative clipping, 9:16 face-tracking, and caption rendering engine over simple REST endpoints and webhooks. Pay strictly for the minutes and clips you process—no rigid monthly seats required.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/contact?intent=api"
                className="inline-flex items-center gap-2 rounded-lg bg-[#67D8DF] px-5 py-3 text-sm font-semibold text-[#07080B] transition hover:brightness-110"
              >
                Request API Key
                <ArrowUpRight size={16} />
              </Link>
              <a
                href="#quickstart"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#141517] px-5 py-3 text-sm font-medium text-[#F4F1E8] transition hover:border-white/30"
              >
                <Terminal size={15} />
                Quickstart & Endpoints
              </a>
            </div>
          </div>

          {/* Right Quick Spec Card */}
          <div className="lg:col-span-5 rounded-xl border border-white/10 bg-[#141517] p-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <span className="font-mono text-xs text-[#67D8DF]">PAY-AS-YOU-GO SUMMARY</span>
              <Zap size={16} className="text-[#E7B84B]" />
            </div>
            <dl className="mt-4 space-y-3.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#8f9095]">Billing model</dt>
                <dd className="font-medium text-white">Metered usage (no minimum)</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#8f9095]">Input sources</dt>
                <dd className="font-medium text-white">YouTube URLs, MP4/MOV, S3 signed URLs</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#8f9095]">Output format</dt>
                <dd className="font-medium text-white">1080×1920 MP4 + JSON timestamps</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#8f9095]">Delivery</dt>
                <dd className="font-medium text-white">Signed CDN URLs & Webhooks</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* Pay-As-You-Go Pricing Table */}
        <section className="py-14 border-b border-white/10">
          <div className="mb-8 max-w-2xl">
            <h2 className="font-display text-2xl font-semibold text-[#F4F1E8] sm:text-3xl">
              Transparent Pay-As-You-Go Pricing
            </h2>
            <p className="mt-2 text-sm text-[#9b9ca3]">
              Start with zero upfront commitment. You are only billed for completed source analysis minutes and rendered clips. Failed jobs cost $0.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {PAYG_RATES.map((rate) => (
              <div
                key={rate.item}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#141517] p-6"
              >
                <div>
                  <p className="font-mono text-[11px] text-[#8f9095]">{rate.unit}</p>
                  <h3 className="mt-2 text-lg font-semibold text-white">{rate.item}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#9b9ca3]">{rate.detail}</p>
                </div>
                <div className="mt-6 border-t border-white/10 pt-4">
                  <span className="font-mono text-2xl font-semibold text-[#E7B84B]">{rate.price}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Code & Integration Quickstart */}
        <section id="quickstart" className="py-14 border-b border-white/10">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#F4F1E8] sm:text-3xl">
                Integrate With Any Stack in 5 Minutes
              </h2>
              <p className="mt-2 text-sm text-[#9b9ca3]">
                Standard JSON over HTTPS. Works seamlessly with cURL, Node.js, Python, Go, n8n, Zapier, or custom backend workers.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-white/10 bg-[#141517] p-1">
              {(Object.keys(CODE_SNIPPETS) as CodeTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    activeTab === tab
                      ? "bg-[#67D8DF] text-[#07080B]"
                      : "text-[#9b9ca3] hover:text-white"
                  }`}
                >
                  {CODE_SNIPPETS[tab].label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#07080A]">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#141517] px-4 py-2.5">
              <span className="font-mono text-xs text-[#8f9095]">
                POST /api/v1/youtube · Bearer Auth
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-[#d7d7da] transition hover:bg-white/10"
              >
                {copied ? <Check size={13} className="text-[#A8FF4F]" /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto p-5 font-mono text-xs leading-6 text-[#d7e6ea]">
              <code>{CODE_SNIPPETS[activeTab].code}</code>
            </pre>
          </div>

          {/* Core Endpoints Overview */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { method: "POST", path: "/api/v1/youtube", desc: "Queue YouTube URL clipping job" },
              { method: "POST", path: "/api/v1/upload", desc: "Upload local MP4/MOV stream" },
              { method: "GET", path: "/api/v1/status/{task_id}", desc: "Poll progress & clip URLs" },
              { method: "POST", path: "/api/v1/clips/{id}/feedback", desc: "Log preference & ranking signals" },
            ].map((ep) => (
              <div key={ep.path} className="rounded-lg border border-white/10 bg-[#141517] p-4">
                <span className="inline-block rounded bg-[#67D8DF]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#67D8DF]">
                  {ep.method}
                </span>
                <p className="mt-2 font-mono text-xs text-white break-all">{ep.path}</p>
                <p className="mt-1 text-xs text-[#8f9095]">{ep.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Enterprise Systems Architecture */}
        <section className="py-14">
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-semibold text-[#F4F1E8] sm:text-3xl">
                Built for Enterprise Systems
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-[#9b9ca3]">
                How media networks, SaaS teams, and high-volume agencies run RelatiV inside production infrastructure.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-[#A8FF4F]">
              <ShieldCheck size={14} />
              99.9% Uptime SLA Available
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {ENTERPRISE_PATTERNS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border border-white/10 bg-[#141517] p-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-[#67D8DF]">
                  <Icon size={18} />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9b9ca3]">{body}</p>
              </div>
            ))}
          </div>

          {/* Enterprise CTA Banner */}
          <div className="mt-10 flex flex-col justify-between gap-6 rounded-xl border border-[#E7B84B]/30 bg-[#141517] p-7 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#E7B84B]">
                <Server size={14} />
                HIGH-VOLUME & DEDICATED INFRASTRUCTURE
              </div>
              <h3 className="mt-2 font-display text-xl font-semibold text-white">
                Need custom throughput, VPC peering, or volume PAYG rates?
              </h3>
              <p className="mt-1 text-sm text-[#9b9ca3]">
                Talk directly with our engineering team to provision API keys and dedicated GPU lanes.
              </p>
            </div>
            <Link
              href="/contact?intent=enterprise"
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#E7B84B] px-5 py-3 text-sm font-semibold text-[#07080B] transition hover:brightness-110"
            >
              Contact Engineering
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
