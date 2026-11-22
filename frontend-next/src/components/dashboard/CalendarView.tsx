"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock3, Plus, Upload } from "lucide-react";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarView({ onSchedule }: { onSchedule: () => void }) {
  const [cursor, setCursor] = useState(() => new Date());
  const cells = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth();
    const first = new Date(year, month, 1), start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  }, [cursor]);
  const move = (amount: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1));
  const today = new Date();
  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="text-2xl font-semibold tracking-[-0.03em] text-[#F4F1E8]">Publishing calendar</h1><p className="mt-1 text-xs text-[#85868b]">A clear view of what is queued and where it will publish.</p></div>
        <div className="flex gap-2"><button onClick={onSchedule} className="flex h-9 items-center gap-2 rounded-md bg-[#F4F1E8] px-4 text-xs font-semibold text-[#151515]"><Plus size={14} />Schedule post</button><button className="flex h-9 items-center gap-2 rounded-md border border-white/[0.08] bg-[#1b1c1f] px-4 text-xs text-white"><Upload size={14} />Upload</button></div>
      </div>
      <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#161719]">
        <div className="flex h-14 items-center justify-between border-b border-white/[0.06] px-4"><button onClick={() => move(-1)} className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.07] text-[#85868b] hover:text-white"><ChevronLeft size={15} /></button><b className="text-sm font-medium text-white">{cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b><button onClick={() => move(1)} className="grid h-8 w-8 place-items-center rounded-md border border-white/[0.07] text-[#85868b] hover:text-white"><ChevronRight size={15} /></button></div>
        <div className="grid grid-cols-7 border-b border-white/[0.06]">{WEEK.map((day) => <div key={day} className="p-3 text-center text-[10px] font-medium text-[#77787d]">{day}</div>)}</div>
        <div className="grid grid-cols-7">{cells.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = day.toDateString() === today.toDateString();
          return <button key={day.toISOString()} className={`min-h-24 border-b border-r border-white/[0.05] p-2 text-left align-top hover:bg-white/[0.025] sm:min-h-28 ${inMonth ? "text-[#a5a6aa]" : "text-[#4f5054]"}`}><span className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-[11px] ${isToday ? "bg-[#E7B84B] font-semibold text-black" : ""}`}>{day.getDate()}</span></button>;
        })}</div>
      </div>
      <p className="flex items-center gap-2 text-[11px] text-[#6f7075]"><Clock3 size={13} />Times use your device timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
    </div>
  );
}
