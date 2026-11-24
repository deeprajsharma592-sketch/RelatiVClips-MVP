"use client";

import FloatingAirship from "@/components/FloatingAirship";
import HeroStudio from "@/components/HeroStudio";
import TasteTimeline from "@/components/TasteTimeline";
import StickyInputBar from "@/components/StickyInputBar";
import SolutionsSection from "@/components/SolutionsSection";
import StudioTower from "@/components/StudioTower";
import styles from "./homepage.module.css";

export default function HomePage() {
  return (
    <div className={`${styles.page} relative min-h-screen w-full overflow-x-clip text-white selection:bg-amber-400 selection:text-black`}>
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.backdropFrame}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.backdropImage} src="/homepage-night-sky.png" alt="" fetchPriority="high" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.starDetail} src="/homepage-night-sky-stars.svg" alt="" />
        </div>
        <FloatingAirship />
      </div>

      <FloatingAirship homepage />

      {/* ── Unobtrusive Floating Bottom Conversion Dock ── */}
      <StickyInputBar />

      {/* ── HERO: Kinetic Long-Form In -> Short-Form Out (Client Spec) ── */}
      <HeroStudio />

      <TasteTimeline />

      <StudioTower />

      {/* ── SECTION: SOLUTIONS FOR EVERY CREATOR & TEAM ── */}
      <SolutionsSection />

    </div>
  );
}
