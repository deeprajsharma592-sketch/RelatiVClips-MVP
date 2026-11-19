"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { SOLUTIONS_COLUMNS } from "@/lib/solutionsData";

export default function SolutionsSection() {
  return (
    <section className="relative py-20 px-4 sm:px-6 bg-[#08080B] border-t border-white/[0.06] text-white">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="max-w-2xl mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-[11px] font-mono uppercase tracking-wider text-zinc-400 border border-white/[0.08] bg-white/[0.02] mb-3">
            <span>WHO IT'S FOR</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-white">
            Built for every creator, brand, and team.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-zinc-400 leading-relaxed">
            From solo podcasters to digital media agencies, RelatiV tailors energy scoring, dynamic reframing, and hook extraction to your exact format.
          </p>
        </div>

        {/* 3-Column Solutions Grid (Exact copy from reference) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10">
          {SOLUTIONS_COLUMNS.map((col, colIdx) => (
            <div key={colIdx} className="space-y-7">
              {col.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className="group block p-4 rounded-xl border border-white/[0.06] bg-[#0E0E13] hover:border-white/20 hover:bg-[#13131A] transition-all duration-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
                      {item.title}
                    </h3>
                    <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <p className="mt-1.5 text-xs sm:text-[13px] text-zinc-400 leading-relaxed group-hover:text-zinc-300 transition-colors">
                    {item.description}
                  </p>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
