"use client";

import { useState, useRef } from "react";
import {
  Upload,
  Link2,
  FolderOpen,
  Film,
  Scissors,
  Wand2,
  Loader2,
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
  onOpenEditor?: () => void;
  hasEditableClip?: boolean;
  isGenerating?: boolean;
}

export default function StudioHero({
  onStartProcess,
  onSubmitUrl,
  onOpenUpgrade,
  onOpenEditor,
  hasEditableClip = false,
  isGenerating = false,
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
    if (isGenerating) {
      setError("A video is currently being clipped. Please wait for it to finish.");
      return;
    }
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
    if (isGenerating) return;
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
    if (isGenerating) {
      setError("A video is currently being clipped. Please wait for it to finish.");
      return;
    }
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
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-x-3">
          <div className="flex flex-wrap items-end gap-1">
            <button
              type="button"
              aria-pressed={activeTab === "clip"}
              onClick={() => setActiveTab("clip")}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-t-[24px] px-3 text-xs font-medium text-zinc-300 transition hover:text-white aria-pressed:bg-[#242527] aria-pressed:text-white sm:px-5 sm:text-sm"
            >
              <Film size={16} className="text-[#A8FF4F]" aria-hidden="true" />
              <span>Clip long video</span>
            </button>

            <button
              type="button"
              aria-pressed={activeTab === "auto-edit"}
              onClick={() => setActiveTab("auto-edit")}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-t-[24px] px-3 text-xs font-medium text-zinc-300 transition hover:text-white aria-pressed:bg-[#242527] aria-pressed:text-white sm:px-5 sm:text-sm"
            >
              <Wand2 size={16} className="text-[#a69afb]" aria-hidden="true" />
              <span>Auto-edit footage</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenEditor}
            disabled={!hasEditableClip || !onOpenEditor}
            title={hasEditableClip ? "Open the newest generated clip in Studio" : "Generate a clip before opening Studio"}
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs transition enabled:cursor-pointer enabled:text-[#9CEAE2] enabled:hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:text-zinc-500 sm:text-sm"
          >
            <Scissors size={15} aria-hidden="true" />
            <span>{hasEditableClip ? "Edit newest clip" : "Open editor"}</span>
          </button>
        </div>

        <div className="overflow-hidden rounded-b-[36px] rounded-tr-[36px] bg-[#242527] shadow-[0_14px_42px_rgba(0,0,0,0.2)]">
          {/* Input Bar */}
          <form onSubmit={handleUrlSubmit} className="space-y-3 px-4 pt-4 sm:px-5 sm:pt-5">
            <div className="relative flex flex-col gap-2 rounded-[26px] border border-white/[0.11] bg-[#18191b] p-2 transition focus-within:border-white/45 sm:flex-row sm:items-center">
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
                  disabled={isGenerating}
                  value={inputText}
                  onPaste={(event) => {
                    if (isGenerating) return;
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
                  placeholder={
                    isGenerating
                      ? "Clip generation in progress... please wait for completion"
                      : "Drop a YouTube link"
                  }
                  className="min-w-0 w-full bg-transparent py-3 text-sm text-white placeholder-[#77787d] focus:outline-none disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={pasteFromClipboard}
                  disabled={isGenerating}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-zinc-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40 cursor-pointer"
                >
                  Paste
                </button>
              </div>
              <button
                type="submit"
                disabled={!inputText.trim() || isGenerating}
                className="flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-center gap-2 rounded-[18px] bg-zinc-50 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition enabled:hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-700 sm:w-auto"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                    <span>Processing...</span>
                  </>
                ) : (
                  "Get clips in 1 click"
                )}
              </button>
            </div>

            {error && <p className="text-xs text-rose-400">{error}</p>}
          </form>

          {/* Secondary Upload Actions Row */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 pb-5 pt-3 text-xs text-[#a1a2a7]">
            <button
              onClick={() => {
                if (isGenerating) {
                  setError("A video is currently being clipped. Please wait for it to finish.");
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={isGenerating}
              className="flex items-center gap-1.5 hover:text-white transition cursor-pointer disabled:opacity-40"
            >
              <Upload size={14} className="text-zinc-500" />
              <span>Upload</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              disabled={isGenerating}
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              onClick={() => alert("Google Drive integration available on Pro.")}
              disabled={isGenerating}
              className="flex items-center gap-1.5 hover:text-white transition cursor-pointer disabled:opacity-40"
            >
              <FolderOpen size={14} className="text-zinc-500" />
              <span>Google Drive</span>
            </button>

            <button
              onClick={() => {
                if (isGenerating) {
                  setError("A video is currently being clipped. Please wait for it to finish.");
                  return;
                }
                setIsConfigModalOpen(true);
              }}
              disabled={isGenerating}
              className="ml-auto text-[#d0d0d3] transition hover:text-white disabled:opacity-40 cursor-pointer"
            >
              Tune captions &amp; framing
            </button>
          </div>

          {uploadStatus && (
            <p className="px-5 pb-4 text-xs text-zinc-300 animate-pulse">{uploadStatus}</p>
          )}
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
            onSubmitUrl(inputText, config);
          }
        }}
        onOpenUpgrade={onOpenUpgrade}
      />
    </div>
  );
}
