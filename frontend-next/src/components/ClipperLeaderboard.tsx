"use client";

import { motion } from "framer-motion";

type Clipper = {
  name: string;
  handle: string;
  avatarHue: "coral" | "gold" | "violet" | "teal";
  specialty: string;
  rank: number;
  monthlyEarnings: string;
  totalClips: number;
  rating: number;
  status: "online" | "clipping" | "live";
};

const TOP_CLIPPERS: Clipper[] = [
  {
    name: "Maya 'HookQueen' Chen",
    handle: "@hookqueen",
    avatarHue: "coral",
    specialty: "Podcasters · Tech",
    rank: 1,
    monthlyEarnings: "$4,820",
    totalClips: 1247,
    rating: 4.9,
    status: "live",
  },
  {
    name: "Devon Wright",
    handle: "@sliceitup",
    avatarHue: "violet",
    specialty: "Sports · MMA",
    rank: 2,
    monthlyEarnings: "$3,915",
    totalClips: 982,
    rating: 4.8,
    status: "clipping",
  },
  {
    name: "Aanya Patel",
    handle: "@aanyaslices",
    avatarHue: "gold",
    specialty: "Education · Science",
    rank: 3,
    monthlyEarnings: "$3,210",
    totalClips: 814,
    rating: 4.9,
    status: "online",
  },
  {
    name: "Tomás Reyes",
    handle: "@tomascuts",
    avatarHue: "teal",
    specialty: "Comedy · Late night",
    rank: 4,
    monthlyEarnings: "$2,840",
    totalClips: 729,
    rating: 4.7,
    status: "clipping",
  },
  {
    name: "Yuki Tanaka",
    handle: "@yukiclips",
    avatarHue: "coral",
    specialty: "Music · Behind the scenes",
    rank: 5,
    monthlyEarnings: "$2,610",
    totalClips: 681,
    rating: 4.8,
    status: "online",
  },
  {
    name: "Lena Müller",
    handle: "@lenacuts",
    avatarHue: "violet",
    specialty: "Brands · D2C",
    rank: 6,
    monthlyEarnings: "$2,440",
    totalClips: 612,
    rating: 5.0,
    status: "live",
  },
];

const HUE_AVATAR_BG: Record<Clipper["avatarHue"], string> = {
  coral: "from-[color:var(--color-accent)] to-[color:var(--color-gradient-magenta)]",
  gold: "from-[color:var(--color-accent-secondary)] to-[color:var(--color-accent)]",
  violet: "from-[color:var(--color-accent-tertiary)] to-[color:var(--color-gradient-violet)]",
  teal: "from-[color:var(--color-accent-quaternary)] to-[color:var(--color-gradient-cyan)]",
};

const STATUS_DOT: Record<Clipper["status"], { color: string; label: string }> = {
  online: { color: "bg-[color:var(--color-success)]", label: "Online" },
  clipping: { color: "bg-[color:var(--color-accent)]", label: "Clipping" },
  live: { color: "bg-[color:var(--color-error)]", label: "Live" },
};

export default function ClipperLeaderboard() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {TOP_CLIPPERS.map((clipper, i) => (
        <motion.div
          key={clipper.handle}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.4, delay: i * 0.06 }}
          className="group relative overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 hover:border-[color:var(--color-border-strong)] transition-all"
        >
          {/* Rank badge */}
          <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:var(--color-bg-base)] border border-[color:var(--color-border)] text-[10px] font-mono text-text-muted">
            <span className="text-[color:var(--color-accent-secondary)]">#{clipper.rank}</span>
          </div>

          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div
                className={`h-14 w-14 rounded-full bg-gradient-to-br ${HUE_AVATAR_BG[clipper.avatarHue]} flex items-center justify-center text-xl font-display font-bold text-[color:var(--color-bg-base)] shadow-lg`}
              >
                {clipper.name[0]}
              </div>
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[color:var(--color-surface)] ${STATUS_DOT[clipper.status].color}`}
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-display font-semibold text-text-primary truncate">
                {clipper.name}
              </div>
              <div className="text-xs text-text-muted font-mono truncate">{clipper.handle}</div>
              <div className="mt-1 text-xs text-text-secondary">{clipper.specialty}</div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[color:var(--color-border)] grid grid-cols-3 gap-2 text-xs">
            <div>
              <div className="text-text-faint font-mono uppercase tracking-wider text-[10px]">Earned</div>
              <div className="mt-0.5 font-mono font-semibold text-[color:var(--color-accent-secondary)]">
                {clipper.monthlyEarnings}
              </div>
            </div>
            <div>
              <div className="text-text-faint font-mono uppercase tracking-wider text-[10px]">Clips</div>
              <div className="mt-0.5 font-mono font-semibold text-text-primary">
                {clipper.totalClips.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-text-faint font-mono uppercase tracking-wider text-[10px]">Rating</div>
              <div className="mt-0.5 font-mono font-semibold text-text-primary flex items-center gap-0.5">
                <span className="text-[color:var(--color-accent-secondary)]">★</span>
                {clipper.rating.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Hover glow */}
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-40 w-40 rounded-full bg-[color:var(--color-glow-primary)] opacity-0 group-hover:opacity-20 blur-3xl transition-opacity duration-500" />
        </motion.div>
      ))}
    </div>
  );
}
