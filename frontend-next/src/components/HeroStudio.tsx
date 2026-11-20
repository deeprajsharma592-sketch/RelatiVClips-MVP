"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  ArrowRight,
  Link2,
  Film,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { uploadVideoFile } from "@/lib/api";
import SickLoadingTransition from "./SickLoadingTransition";
import { ImageGallery, type GalleryImage } from "@/components/dimaac/image-gallery";

const images: GalleryImage[] = [
  { src: "https://ui.dimaac.com/media/portraits/tinted-glasses-4x5.jpg", alt: "Woman in purple-tinted sunglasses against an orange glow" },
  { src: "https://ui.dimaac.com/media/portraits/neon-profile-4x5.jpg", alt: "Profile of a woman in neon pink sunglasses on a blue background" },
  { src: "https://ui.dimaac.com/media/fashion/gold-visor-4x5.jpg", alt: "Profile with a gold headpiece on a yellow background" },
  { src: "https://ui.dimaac.com/media/portraits/red-coat-4x5.jpg", alt: "Person in a red coat against deep blue" },
  { src: "https://ui.dimaac.com/media/portraits/lime-blazer-4x5.jpg", alt: "Person in a lime green blazer on a pink background" },
  { src: "https://ui.dimaac.com/media/fashion/orange-visor-4x5.jpg", alt: "Woman in an orange visor on a teal background" },
  { src: "https://ui.dimaac.com/media/fashion/chunky-knit-4x5.jpg", alt: "Model in a chunky knit sweater and coral boots" },
  { src: "https://ui.dimaac.com/media/fashion/purple-hoodie-4x5.jpg", alt: "Person in a purple tie-dye hoodie in a concrete room" },
  { src: "https://ui.dimaac.com/media/portraits/platinum-blonde-4x5.jpg", alt: "Young man with platinum blonde hair in a yellow jacket" },
  { src: "https://ui.dimaac.com/media/fashion/orange-ring-4x5.jpg", alt: "Young man framed through an orange circle" },
];

const ROTATING_PHRASES = [
  "Tasteful Clips",
  "Get More Views",
  "According to your Niche",
  "Hyperpersonalised Content",
];

export default function HeroStudio() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % ROTATING_PHRASES.length);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

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
    <section className="relative w-full h-[760px] sm:h-[800px] md:h-[840px] flex items-center justify-center bg-black text-white px-4 overflow-hidden font-sans">
      {/* ── LOWER LAYER: 3D Rotating Card Gallery (overlaps beneath img 2) ── */}
      <div className="absolute inset-0 z-0 w-full h-full pointer-events-auto">
        <ImageGallery
          images={images}
          ringSize={52}
          tileScale={0.9}
          radius={9}
          autoSpin={8}
          pauseOnHover={false}
          className="w-full h-full"
        />
      </div>

      {/* ── UPPER LAYER: img 2 (Main text, subtitle, input bar) ── */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 text-center flex flex-col items-center space-y-6 pointer-events-none">
        {/* Master Headline (OpusClip exact match) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="space-y-2 select-none"
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-display font-extrabold tracking-tight text-white leading-[1.1] drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)]">
            Turn any footage into
          </h1>
          <div className="flex items-center justify-center flex-wrap gap-2 text-3xl sm:text-4xl md:text-5xl font-display font-extrabold tracking-tight drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)]">
            <motion.span
              layout
              transition={{ layout: { duration: 0.3, ease: "easeOut" } }}
              className="relative inline-flex items-center justify-center overflow-hidden px-4 py-1 rounded-full bg-black/60 border border-white/20 text-white backdrop-blur-xl h-[1.35em]"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={ROTATING_PHRASES[phraseIndex]}
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -24, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="inline-block whitespace-nowrap"
                >
                  {ROTATING_PHRASES[phraseIndex]}
                </motion.span>
              </AnimatePresence>
            </motion.span>
            <span className="text-white">10x faster</span>
          </div>
        </motion.div>

        {/* Subtitle (OpusClip exact match) */}
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-xs sm:text-sm text-zinc-300 max-w-lg mx-auto leading-relaxed drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]"
        >
          Paste a link or drop a raw take, and RelatiV clips, edits, sizes and publishes them to all social platforms in one click.
        </motion.p>

        {/* ── Centered Input Bar (OpusClip exact match) ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="w-full max-w-xl mx-auto pt-2 pointer-events-auto"
        >
          <form
            onSubmit={handleSubmit}
            className="flex items-center rounded-full border border-white/20 bg-black/60 p-1.5 backdrop-blur-xl shadow-2xl focus-within:border-white/40 transition"
          >
            <div
              onClick={() => fileInputRef.current?.click()}
              className="pl-3 pr-2 text-zinc-400 hover:text-white cursor-pointer transition shrink-0"
              title="Upload video file"
            >
              <Link2 className="w-4 h-4" />
            </div>

            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Drop a video link or upload a file"
              className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 ring-0 border-0 py-1.5"
              style={{ outline: "none", boxShadow: "none" }}
            />

            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="submit"
              className="px-4 py-2 rounded-full bg-white text-black hover:bg-zinc-200 text-xs font-bold transition shrink-0 cursor-pointer shadow-sm"
            >
              Get free clips
            </button>

            <span className="text-zinc-500 text-xs px-2 shrink-0">or</span>

            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-xs text-zinc-300 hover:text-white font-medium pr-3 shrink-0 transition cursor-pointer"
            >
              Auto-edit
            </button>
          </form>

          {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
        </motion.div>
      </div>

      {/* Loading transition */}
      {isSubmitting && url && (
        <SickLoadingTransition url={url} autoRedirect={true} />
      )}
    </section>
  );
}
