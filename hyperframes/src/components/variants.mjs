/**
 * Closed-vocabulary visual design variants (A, B, C) for all 10 HyperFrames v1 components.
 * Grounded in RelatiV's design tokens (#FFCC00, #4967E8, #8B5CF6, #14B8A6, #FB7185, #111318).
 */

export const DESIGN_TOKENS = Object.freeze({
  gold: "#FFCC00",
  amber: "#FBBF24",
  cobalt: "#4967E8",
  violet: "#8B5CF6",
  teal: "#14B8A6",
  coral: "#FB7185",
  obsidian: "#111318",
  voidBlack: "#0C0A09",
  white: "#FFFFFF",
  offWhite: "#F7F8FA",
});

export const COMPONENT_VARIANTS = Object.freeze({
  punchy_bounce: {
    A: {
      name: "Signature Gold",
      font: "'Montserrat Black', 'Montserrat', sans-serif",
      fontSize: 68,
      color: "#FFFFFF",
      accent: "#FFCC00",
      stroke: "2px #0C0A09",
      duration: 0.18,
      ease: "back.out(2.4)",
      from: { opacity: 0, scale: 0.72, y: 12 },
      to: { opacity: 1, scale: 1, y: 0 },
    },
    B: {
      name: "Obsidian Pill",
      font: "'Inter ExtraBold', 'Inter', sans-serif",
      fontSize: 58,
      color: "#FFFFFF",
      bg: "rgba(17, 19, 24, 0.85)",
      border: "1px solid rgba(255, 255, 255, 0.14)",
      duration: 0.16,
      ease: "power3.out",
      from: { opacity: 0, scale: 0.9, y: 18 },
      to: { opacity: 1, scale: 1, y: 0 },
    },
    C: {
      name: "Kinetic Impact",
      font: "'Anton', sans-serif",
      fontSize: 76,
      color: "#FFCC00",
      shadow: "0 6px 0 #0C0A09",
      duration: 0.14,
      ease: "expo.out",
      from: { opacity: 0, scaleY: 1.25, scaleX: 0.9 },
      to: { opacity: 1, scaleY: 1, scaleX: 1 },
    },
  },
  highlight_word: {
    A: {
      name: "Gold Sweep Pill",
      font: "'Montserrat ExtraBold', 'Montserrat', sans-serif",
      fontSize: 62,
      baseColor: "rgba(255, 255, 255, 0.72)",
      activeColor: "#111318",
      activeBg: "#FFCC00",
      duration: 0.11,
      ease: "power2.out",
    },
    B: {
      name: "Cobalt-Violet Underline",
      font: "'Poppins ExtraBold', 'Poppins', sans-serif",
      fontSize: 60,
      baseColor: "rgba(255, 255, 255, 0.75)",
      activeColor: "#FFFFFF",
      underline: "linear-gradient(90deg, #4967E8, #8B5CF6)",
      duration: 0.12,
      ease: "power3.out",
    },
    C: {
      name: "Teal Glow Pop",
      font: "'Inter ExtraBold', 'Inter', sans-serif",
      fontSize: 60,
      baseColor: "rgba(247, 248, 250, 0.65)",
      activeColor: "#14B8A6",
      glow: "0 0 18px rgba(20, 184, 166, 0.55)",
      duration: 0.1,
      ease: "back.out(1.8)",
    },
  },
  zoom_punch: {
    A: { name: "Hook Slam", scale: 1.18, inDur: 0.09, holdDur: 0.18, outDur: 0.26, easeIn: "power4.out", easeOut: "power2.inOut", rotation: 0 },
    B: { name: "Micro-Beat", scale: 1.09, inDur: 0.11, holdDur: 0.05, outDur: 0.22, easeIn: "power3.out", easeOut: "power2.out", rotation: 0 },
    C: { name: "Whip Zoom", scale: 1.14, inDur: 0.08, holdDur: 0.12, outDur: 0.24, easeIn: "expo.out", easeOut: "power2.inOut", rotation: -1.2 },
  },
  shake: {
    A: { name: "Hook Impact", amplitude: 10, rotation: 1.5, duration: 0.28 },
    B: { name: "Subtle Rumble", amplitude: 4, rotation: 0, duration: 0.2 },
    C: { name: "Flash Jolt", amplitude: 8, rotation: 0, duration: 0.14, singleAxis: true },
  },
  whip_transition: {
    A: { name: "Horizontal Whip", axis: "x", durationIn: 0.11, durationOut: 0.14, streakColor: "#FFCC00" },
    B: { name: "Vertical Whip", axis: "y", durationIn: 0.12, durationOut: 0.15, streakColor: "#4967E8" },
    C: { name: "Flash Whip", axis: "flash", durationIn: 0.09, durationOut: 0.13, streakColor: "#FFFFFF" },
  },
  popup_image: {
    A: { name: "RelatiV Glass", border: "1px solid rgba(255, 204, 0, 0.45)", bg: "rgba(17, 19, 24, 0.80)", radius: 20, ease: "back.out(1.9)", duration: 0.2 },
    B: { name: "Polaroid Tilt", border: "6px solid #FFFFFF", bg: "#FFFFFF", radius: 8, rotation: -2.5, ease: "power3.out", duration: 0.18 },
    C: { name: "Cutout Glow", border: "none", bg: "transparent", glow: "0 0 28px rgba(255, 204, 0, 0.45)", ease: "back.out(2.1)", duration: 0.17 },
  },
  popup_screenshot: {
    A: { name: "Browser Chrome", border: "1px solid rgba(255, 255, 255, 0.16)", bg: "rgba(17, 19, 24, 0.90)", ease: "power3.out", duration: 0.21 },
    B: { name: "Gold Quote Wipe", accentBar: "4px solid #FFCC00", bg: "rgba(12, 10, 9, 0.88)", ease: "expo.out", duration: 0.22 },
    C: { name: "Cobalt Rim Card", border: "1px solid rgba(73, 103, 232, 0.45)", bg: "rgba(12, 10, 9, 0.90)", ease: "power2.out", duration: 0.18 },
  },
  emoji_reaction: {
    A: { name: "Hero Burst", size: 84, burstBg: "rgba(255, 204, 0, 0.20)", ease: "back.out(2.6)", duration: 0.2 },
    B: { name: "Staggered Stream", size: 64, stagger: 0.06, ease: "power2.out", duration: 0.55 },
    C: { name: "Corner Badge Pill", size: 48, border: "1px solid #FFCC00", bg: "rgba(17, 19, 24, 0.85)", ease: "back.out(2.2)", duration: 0.16 },
  },
  lower_third: {
    A: { name: "Glass Bar", bg: "rgba(17, 19, 24, 0.82)", accent: "#FFCC00", font: "'Montserrat ExtraBold', sans-serif", ease: "power3.out", duration: 0.22 },
    B: { name: "Cobalt Pill", bg: "linear-gradient(90deg, #4967E8, #7955C7)", accent: "#FFFFFF", font: "'Inter Bold', sans-serif", ease: "expo.out", duration: 0.2 },
    C: { name: "Broadcast Strip", bg: "rgba(12, 10, 9, 0.75)", accent: "#14B8A6", font: "'Inter ExtraBold', sans-serif", ease: "power2.out", duration: 0.18 },
  },
  callback_flash: {
    A: { name: "Gold Flashback", flashColor: "rgba(255, 204, 0, 0.35)", badge: "EARLIER", badgeColor: "#FFCC00", flashDur: 0.08, scale: 1.06 },
    B: { name: "CRT Stream Cut", flashColor: "rgba(255, 255, 255, 0.45)", badge: "REPLAY", badgeColor: "#FB7185", flashDur: 0.06, scale: 1.04 },
    C: { name: "Cobalt Pulse", flashColor: "rgba(73, 103, 232, 0.30)", badge: "CALLBACK", badgeColor: "#4967E8", flashDur: 0.08, scale: 0.96 },
  },
});
