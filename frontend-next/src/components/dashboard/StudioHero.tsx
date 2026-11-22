"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Sparkles,
  Link2,
  FolderOpen,
  ArrowRight,
  Film,
  Scissors,
  Wand2,
  Tv,
  Check,
} from "lucide-react";
import PreGenConfigModal, { RecipeConfig } from "./PreGenConfigModal";
import { uploadVideoFile, submitLocalVideo } from "@/lib/api";

function normalizeYouTubeUrl(value: string) {
  const candidate = value.trim();
  if (!candidate) return null;

  try {
    const parsed = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const isYouTube =
      hostname === "youtu.be" ||
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com");
    return isYouTube ? parsed.toString() : null;
  } catch {
    return null;
  }
}

interface StudioHeroProps {
  onStartProcess?: (taskId: string, template?: string) => void;
  onSubmitUrl?: (url: string, template?: string) => void;
  onOpenUpgrade?: () => void;
}

interface RecipePill {
  id: string;
  label: string;
  isHot?: boolean;
}

const RECIPE_PILLS: RecipePill[] = [
  { id: "podcast", label: "Clip podcast interviews" },
  { id: "gaming", label: "Clip gaming streams", isHot: true },
  { id: "gameplay", label: "Edit gameplay clips", isHot: true },
  { id: "educational", label: "Auto-edit talking videos" },
  { id: "captions", label: "Captions" },
  { id: "reframe", label: "Reframe" },
  { id: "upscale", label: "Upscale" },
  { id: "social", label: "Social edits", isHot: true },
  { id: "broll", label: "AI B-roll" },
  { id: "cleanup", label: "Clean up recording", isHot: true },
  { id: "translate", label: "Translate & dub" },
];

export default function StudioHero({
  onStartProcess,
  onSubmitUrl,
  onOpenUpgrade,
}: StudioHeroProps) {
  const [activeTab, setActiveTab] = useState<"clip" | "auto-edit">("clip");
  const [inputText, setInputText] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("podcast");
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const normalized = normalizeYouTubeUrl(inputText);
    if (!inputText.trim()) return;

    if (!normalized) {
      setError("Please paste a valid YouTube video link (e.g. youtube.com/watch?v=...)");
      return;
    }

    setInputText(normalized);
    setError(null);
    setIsConfigModalOpen(true);
  };

  const pasteFromClipboard = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (!clipboardText.trim()) {
        setError("Your clipboard does not contain a link.");
        return;
      }
      setInputText(clipboardText.trim());
      setError(null);
      requestAnimationFrame(() => {
        urlInputRef.current?.focus();
        urlInputRef.current?.setSelectionRange(clipboardText.trim().length, clipboardText.trim().length);
      });
    } catch {
      setError("Clipboard access was blocked. Use Ctrl+V or Cmd+V to paste the link.");
    }
  };

  const handlePillClick = (pillId: string) => {
    setSelectedTemplate(pillId);
    if (normalizeYouTubeUrl(inputText)) {
      setIsConfigModalOpen(true);
    } else {
      setInputText("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      setIsConfigModalOpen(true);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/") && !file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i)) {
      setError("Please select a valid video file (MP4, MOV, WEBM).");
      return;
    }

    setError(null);
    setUploadStatus("Uploading footage to Studio...");

    try {
      const { filePath } = await uploadVideoFile(file);
      setUploadStatus("Starting AI virality pipeline...");
      const init = await submitLocalVideo(filePath);
      if (onStartProcess) {
        onStartProcess(init.taskId, selectedTemplate);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload video.");
    } finally {
      setUploadStatus(null);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-10 font-sans">
      {/* ── CENTRAL INTAKE CARD (Exact match to OpusClip picture) ── */}
      <div className="rounded-xl border border-white/[0.08] bg-[#121215] p-5 sm:p-6 space-y-5 shadow-2xl">
        {/* Tabs Bar */}
        <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("clip")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "clip"
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Clip long video</span>
            </button>

            <button
              onClick={() => setActiveTab("auto-edit")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "auto-edit"
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Wand2 size={13} className="text-zinc-400" />
              <span>Auto-edit footage</span>
            </button>
          </div>

          <button
            onClick={() => alert("Open editor mode")}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
          >
            <Scissors size={13} />
            <span>Open editor</span>
          </button>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleUrlSubmit} className="space-y-3">
          <div className="relative flex flex-col gap-2 rounded-lg border border-white/10 bg-[#0A0A0C] p-2 focus-within:border-white/30 transition sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center px-1.5">
              <Link2 className="w-4 h-4 text-zinc-500 mr-2.5 shrink-0" />
              <input
                ref={urlInputRef}
                type="text"
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="url"
                spellCheck={false}
                maxLength={2048}
                aria-label="YouTube video URL"
                value={inputText}
                onPaste={(event) => {
                  const pasted = event.clipboardData.getData("text");
                  if (!pasted) return;
                  event.preventDefault();
                  setInputText(pasted.trim());
                  setError(null);
                }}
                onChange={(e) => {
                  setInputText(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Paste the full YouTube URL here"
                className="min-w-0 w-full bg-transparent text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none py-2"
              />
              <button
                type="button"
                onClick={pasteFromClipboard}
                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                Paste
              </button>
            </div>
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-full px-4 py-2.5 rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-40 text-xs font-bold transition shrink-0 cursor-pointer shadow-sm sm:w-auto"
            >
              Get clips in 1 click
            </button>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}
        </form>

        {/* Secondary Upload Actions Row */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-400 pt-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 hover:text-white transition cursor-pointer"
          >
            <Upload size={14} className="text-zinc-500" />
            <span>Upload</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            onClick={() => alert("Google Drive integration available on Pro.")}
            className="flex items-center gap-1.5 hover:text-white transition cursor-pointer"
          >
            <FolderOpen size={14} className="text-zinc-500" />
            <span>Google Drive</span>
          </button>

          <button
            onClick={() => {
              setInputText("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
              setIsConfigModalOpen(true);
            }}
            className="text-zinc-400 hover:text-white transition underline underline-offset-2 cursor-pointer ml-auto"
          >
            Try a sample project
          </button>
        </div>

        {uploadStatus && (
          <p className="text-xs text-zinc-300 font-mono animate-pulse">{uploadStatus}</p>
        )}
      </div>

      {/* ── RECIPE CHIPS ROW (Exact match to OpusClip picture) ── */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {RECIPE_PILLS.map((pill) => (
            <button
              key={pill.id}
              onClick={() => handlePillClick(pill.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#121215] hover:bg-white/[0.06] text-xs text-zinc-300 transition cursor-pointer"
            >
              <span>{pill.label}</span>
              {pill.isHot && <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />}
            </button>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition"
          >
            See all Recipes &gt;
          </button>
        </div>
      </div>

      {/* Pre-generation Recipe Configuration Modal */}
      <PreGenConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        videoUrl={inputText}
        onConfirm={(config: RecipeConfig) => {
          setIsConfigModalOpen(false);
          if (onSubmitUrl) {
            onSubmitUrl(inputText, config.template);
          }
        }}
        onOpenUpgrade={onOpenUpgrade}
      />
    </div>
  );
}
