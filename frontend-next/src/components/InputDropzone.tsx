"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import PhysicsIcon from "./PhysicsIcon";

interface InputDropzoneProps {
  onUrlSubmit: (url: string) => void;
  onFileSubmit: (file: File) => void;
  disabled?: boolean;
}

export default function InputDropzone({
  onUrlSubmit,
  onFileSubmit,
  disabled,
}: InputDropzoneProps) {
  const [url, setUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = useCallback(() => {
    if (url.trim()) {
      onUrlSubmit(url.trim());
    }
  }, [url, onUrlSubmit]);

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("video/")) {
        setSelectedFile(file);
      }
    },
    []
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSelectedFile(file);
      }
    },
    []
  );

  const handleFileSubmit = useCallback(() => {
    if (selectedFile) {
      onFileSubmit(selectedFile);
    }
  }, [selectedFile, onFileSubmit]);

  const clearSelection = useCallback(() => {
    setSelectedFile(null);
    setUrl("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-display font-bold text-white mb-1">
          Input Source
        </h2>
        <p className="text-sm text-text-muted">
          Provide a video URL or upload a local file to begin extraction.
        </p>
      </div>

      {/* URL Input */}
      <div>
        <label className="block text-xs font-mono text-text-muted mb-2">
          [Φ] Video URL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleUrlSubmit();
            }}
            placeholder="https://youtube.com/watch?v=..."
            disabled={disabled || !!selectedFile}
            className="flex-1 bg-surface border border-border rounded-[4px] px-4 py-3 text-sm text-white placeholder-text-muted/40 font-sans input-glow transition-all duration-200 disabled:opacity-40"
          />
          <motion.button
            onClick={handleUrlSubmit}
            disabled={!url.trim() || disabled || !!selectedFile}
            className="px-5 py-3 bg-accent text-white text-sm font-semibold rounded-[4px] font-sans disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
            whileHover={
              !disabled && url.trim()
                ? { scale: 1.02, boxShadow: "0 0 20px rgba(77,77,255,0.3)" }
                : {}
            }
            whileTap={!disabled && url.trim() ? { scale: 0.98 } : {}}
          >
            Extract [Φ]
          </motion.button>
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted font-mono">[∥]</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Dropzone */}
      <motion.div
        className={`relative border-2 border-dashed rounded-[4px] p-8 text-center transition-all duration-200 cursor-pointer ${
          isDragging
            ? "border-accent bg-accent/5 dropzone-active"
            : selectedFile
              ? "border-accent-secondary bg-accent-secondary/5"
              : "border-border hover:border-accent"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        animate={
          isDragging
            ? { scale: 1.01 }
            : { scale: 1 }
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/avi,video/mov,video/webm"
          onChange={handleFileSelect}
          className="hidden"
        />

        {selectedFile ? (
          <div className="space-y-2">
            <span className="text-2xl text-accent-secondary">✓</span>
            <p className="text-sm text-white font-semibold">
              {selectedFile.name}
            </p>
            <p className="text-xs text-text-muted">
              {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <span className="text-2xl text-text-muted">↑</span>
            <p className="text-sm text-text-muted">
              <span className="text-accent font-semibold">Click to upload</span>{" "}
              or drag and drop
            </p>
            <p className="text-xs text-text-muted/60">MP4, AVI, MOV, WEBM</p>
          </div>
        )}
      </motion.div>

      {/* File submit / clear */}
      {selectedFile && (
        <div className="space-y-2">
          <div className="p-3 bg-accent-secondary/5 border border-accent-secondary/20 rounded-[2px]">
            <p className="text-[11px] text-accent-secondary font-mono">
              [⚠] File upload requires the local processing endpoint. Use a YouTube URL in the field above for now.
            </p>
          </div>
          <div className="flex gap-2">
            <motion.button
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              disabled={disabled}
              className="flex-1 px-5 py-3 bg-border text-text-muted text-sm font-semibold rounded-[4px] font-sans hover:bg-accent hover:text-white transition-colors disabled:opacity-30"
              whileHover={!disabled ? { scale: 1.02 } : {}}
            >
              Clear &amp; Use URL Instead
            </motion.button>
          </div>
        </div>
      )}

      {/* Render full URL button when URL is entered */}
      {url.trim() && !selectedFile && (
        <motion.button
          onClick={handleUrlSubmit}
          disabled={disabled}
          className="w-full px-5 py-3 bg-accent text-white text-sm font-semibold rounded-[4px] font-sans disabled:opacity-30"
          whileHover={
            !disabled
              ? { scale: 1.02, boxShadow: "0 0 20px rgba(77,77,255,0.3)" }
              : {}
          }
          whileTap={!disabled ? { scale: 0.98 } : {}}
        >
          Initialize Extraction [Φ]
        </motion.button>
      )}
    </div>
  );
}
