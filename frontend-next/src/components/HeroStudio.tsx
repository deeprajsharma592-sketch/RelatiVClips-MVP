"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { uploadVideoFile } from "@/lib/api";
import SickLoadingTransition from "./SickLoadingTransition";
import CylinderScrollHeadline from "./CylinderScrollHeadline";

export default function HeroStudio() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setIsSubmitting(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { taskId } = await uploadVideoFile(file);
      router.push(`/dashboard?taskId=${taskId}`);
    } catch {
      setError("Upload failed. Try pasting a YouTube link instead.");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <CylinderScrollHeadline>
        <div className="mt-8 w-full max-w-5xl pointer-events-auto">
          <form
            onSubmit={handleSubmit}
            className="flex items-center rounded-xl border border-white/20 bg-black/60 p-2 sm:p-2.5 backdrop-blur-xl shadow-2xl focus-within:border-white/40 transition"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="pl-3 pr-2 sm:pl-4 text-zinc-400 hover:text-white cursor-pointer transition shrink-0"
              title="Upload video file"
              aria-label="Upload video file"
            >
              <Link2 className="w-5 h-5" />
            </button>

            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Drop a video link or upload a file"
              className="w-full min-w-0 bg-transparent text-sm sm:text-base text-white placeholder-zinc-500 outline-none ring-0 border-0 py-2.5 sm:py-3"
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <button type="submit" className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg bg-white text-black hover:bg-zinc-200 text-sm sm:text-base font-bold transition shrink-0 cursor-pointer shadow-sm">
              Get free clips
            </button>

            <span className="hidden sm:inline text-zinc-500 text-sm px-2 sm:px-3 shrink-0">or</span>
            <button type="button" onClick={() => router.push("/dashboard")} className="hidden sm:inline text-sm text-zinc-300 hover:text-white font-medium pr-3 sm:pr-4 shrink-0 transition cursor-pointer">
              Auto-edit
            </button>
          </form>
          {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        </div>
      </CylinderScrollHeadline>

      {isSubmitting && url && <SickLoadingTransition url={url} autoRedirect />}
    </>
  );
}
