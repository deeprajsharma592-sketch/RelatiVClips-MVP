"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Link2,
  FolderOpen,
  Film,
  Scissors,
  Wand2,
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
  onSubmitUrl?: (url: string, config: RecipeConfig) => void;
  onOpenUpgrade?: () => void;
}

export default function StudioHero({
  onStartProcess,
  onSubmitUrl,
  onOpenUpgrade,
}: StudioHeroProps) {
  const [activeTab, setActiveTab] = useState<"clip" | "auto-edit">("clip");
  const [inputText, setInputText] = useState("");
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
        onStartProcess(init.taskId, "podcast");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload video.");
    } finally {
      setUploadStatus(null);
    }
  };

  return (
    <div className="w-full min-w-0 font-sans">
      <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-white/[0.1] bg-[#17181a] shadow-[0_24px_70px_rgba(0,0,0,0.24)] ring-1 ring-black/30">
        {/* Tabs Bar */}
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1">
            <button
              onClick={() => setActiveTab("clip")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "clip"
                ? "bg-[#292a2d] text-white shadow-sm ring-1 ring-white/[0.06]"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Film size={14} className="text-[#A8FF4F]" />
              <span>Clip long video</span>
            </button>

            <button
              onClick={() => setActiveTab("auto-edit")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab === "auto-edit"
                ? "bg-[#292a2d] text-white shadow-sm ring-1 ring-white/[0.06]"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
              }`}
            >
              <Wand2 size={13} className="text-zinc-400" />
              <span>Auto-edit footage</span>
            </button>
          </div>

          <button
            onClick={() => alert("Open editor mode")}
            className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300 cursor-pointer"
          >
            <Scissors size={13} />
            <span>Open editor</span>
          </button>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleUrlSubmit} className="space-y-3 px-4 pt-4 sm:px-5 sm:pt-5">
          <div className="relative flex flex-col gap-2 rounded-xl border border-white/[0.11] bg-[#101113] p-2 transition focus-within:border-[#E7B84B]/55 focus-within:shadow-[0_0_0_3px_rgba(231,184,75,0.08)] sm:flex-row sm:items-center">
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
                placeholder="Paste a YouTube link"
                className="min-w-0 w-full bg-transparent py-3 text-sm text-white placeholder-[#77787d] focus:outline-none"
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
              className="w-full shrink-0 rounded-lg bg-[#F4F1E8] px-5 py-3 text-xs font-semibold text-[#151515] transition hover:bg-white disabled:opacity-35 cursor-pointer sm:w-auto"
            >
              Get clips in 1 click
            </button>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}
        </form>

        {/* Secondary Upload Actions Row */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 pb-5 pt-3 text-xs text-[#a1a2a7]">
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

          <button onClick={() => setIsConfigModalOpen(true)} className="ml-auto text-[#d0d0d3] transition hover:text-white">Tune captions & framing</button>
        </div>

        {uploadStatus && (
          <p className="px-5 pb-4 text-xs text-zinc-300 animate-pulse">{uploadStatus}</p>
        )}
      </div>

      {/* Pre-generation Recipe Configuration Modal */}
      <PreGenConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        videoUrl={inputText}
        onConfirm={(config: RecipeConfig) => {
          setIsConfigModalOpen(false);
          if (onSubmitUrl) {
            onSubmitUrl(inputText, config);
          }
        }}
        onOpenUpgrade={onOpenUpgrade}
      />
    </div>
  );
}
