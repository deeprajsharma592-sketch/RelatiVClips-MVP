"use client";

import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";

interface VideoPlayerProps {
  src?: string;
  label?: string;
}

export default function VideoPlayer({ src, label }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleLoadedData = useCallback(() => {
    setIsLoading(false);
  }, []);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="space-y-4">
      {label && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-accent-secondary">[▶]</span>
          <span className="text-sm font-display text-white font-semibold">
            {label}
          </span>
        </div>
      )}

      <div className="relative bg-black border border-border rounded-[4px] overflow-hidden aspect-9-16 max-h-[70vh]">
        {src ? (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
                <motion.div
                  className="w-12 h-12 border-2 border-accent/30 border-t-accent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
                <span className="text-xs text-text-muted font-mono">
                  Loading clip...
                </span>
              </div>
            )}
            <video
              ref={videoRef}
              src={src}
              className={`w-full h-full object-contain ${isLoading ? "opacity-0" : "opacity-100"}`}
              onLoadedData={handleLoadedData}
              onEnded={() => setIsPlaying(false)}
              controls
            />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="text-4xl text-border">▶</span>
            <span className="text-xs text-text-muted font-mono">
              [∅] No clip loaded
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
