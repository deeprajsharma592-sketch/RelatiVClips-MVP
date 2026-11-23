"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Star, Trash2 } from "lucide-react";
import type { EditorWord } from "@/types/editor";

function stamp(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toFixed(1).padStart(4, "0")}`;
}

export default function TranscriptEditor({
  words,
  currentTime,
  onSeek,
  onChange,
}: {
  words: EditorWord[];
  currentTime: number;
  onSeek: (time: number) => void;
  onChange: (words: EditorWord[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const selectedWord = words.find((word) => word.id === selected);
  const lines = useMemo(() => {
    const result: EditorWord[][] = [];
    words.forEach((word) => {
      const line = result.at(-1);
      if (!line || word.start - line.at(-1)!.end > 0.4 || line.length >= 11) result.push([word]);
      else line.push(word);
    });
    return result;
  }, [words]);

  const update = (id: string, patch: Partial<EditorWord>) => onChange(words.map((word) => word.id === id ? { ...word, ...patch } : word));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-white/[0.08] px-4 py-3">
        <div className="text-xs font-semibold text-[#F1EEE5]">Synchronized script</div>
        <div className="mt-1 text-[10px] text-[#777980]">Click to seek · double-click to correct</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-color:#303238_transparent]">
        <div className="space-y-4">
          {lines.map((line, lineIndex) => (
            <div key={`${lineIndex}-${line[0]?.id}`} className="relative border-l border-white/[0.07] pl-3">
              <span className="mb-1.5 block font-mono text-[9px] text-[#55575E]">{stamp(line[0]?.start || 0)}</span>
              <p className="flex flex-wrap gap-x-1.5 gap-y-1.5 leading-7">
                {line.map((word) => {
                  const active = currentTime >= word.start && currentTime <= word.end + 0.08;
                  if (editing === word.id) return (
                    <input
                      key={word.id}
                      autoFocus
                      defaultValue={word.w}
                      onBlur={(event) => { update(word.id, { w: event.target.value.trim() || word.w }); setEditing(null); }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                        if (event.key === "Escape") setEditing(null);
                      }}
                      className="h-7 w-24 border border-[#4FD1C5]/70 bg-[#08090C] px-1.5 text-sm text-white outline-none"
                    />
                  );
                  return (
                    <button
                      key={word.id}
                      type="button"
                      onClick={() => { setSelected(word.id); onSeek(word.start); }}
                      onDoubleClick={() => setEditing(word.id)}
                      className={`relative text-[13px] transition ${word.deleted ? "text-[#5C5E64] line-through opacity-55" : word.emph ? "bg-[#E7B84B]/12 px-1 text-[#F0C96A]" : active ? "text-white" : "text-[#B0B1B5] hover:text-white"}`}
                    >
                      {word.w}
                      {active && !word.deleted && <span className="absolute inset-x-0 -bottom-0.5 h-px bg-[#4FD1C5] shadow-[0_0_8px_#4FD1C5]" />}
                    </button>
                  );
                })}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/[0.08] bg-[#0D0E12] p-3">
        {selectedWord ? (
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => update(selectedWord.id, { emph: selectedWord.emph ? 0 : 1 })} className="flex h-8 flex-1 items-center justify-center gap-1.5 border border-white/10 text-[10px] text-[#CBC9C2] hover:bg-white/5"><Star className="size-3" /> Emphasize</button>
            <button type="button" onClick={() => update(selectedWord.id, { deleted: !selectedWord.deleted })} className="flex h-8 flex-1 items-center justify-center gap-1.5 border border-white/10 text-[10px] text-[#CBC9C2] hover:bg-white/5">
              {selectedWord.deleted ? <RotateCcw className="size-3" /> : <Trash2 className="size-3" />} {selectedWord.deleted ? "Restore" : "Cut word"}
            </button>
          </div>
        ) : <div className="h-8 text-center text-[10px] leading-8 text-[#5F6168]">Select a word to edit</div>}
      </div>
    </div>
  );
}
