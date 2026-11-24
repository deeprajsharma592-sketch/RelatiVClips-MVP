import type { CSSProperties } from "react";

interface BrandLogoProps {
  iconWidth?: number;
  wordmarkClassName?: string;
  wordmarkStyle?: CSSProperties;
  className?: string;
}

/** RelatiV waveform-to-play brand mark and wordmark. */
export default function BrandLogo({
  iconWidth = 42,
  wordmarkClassName = "font-display text-base font-bold tracking-tight text-white",
  wordmarkStyle,
  className = "",
}: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        aria-hidden="true"
        width={iconWidth}
        height={Math.round(iconWidth * (104 / 192))}
        viewBox="0 0 192 104"
        fill="none"
        className="shrink-0"
      >
        <rect x="6" y="39" width="14" height="26" rx="7" fill="#FFCC00" />
        <rect x="32" y="27" width="14" height="50" rx="7" fill="#FFCC00" />
        <rect x="58" y="8" width="14" height="88" rx="7" fill="#FFCC00" />
        <rect x="84" y="26" width="14" height="52" rx="7" fill="#FFCC00" />
        <rect x="110" y="34" width="14" height="36" rx="7" fill="#FFCC00" />
        <path
          d="M148 14.2c-4.5-3-10.6.2-10.6 5.6v64.4c0 5.4 6.1 8.6 10.6 5.6l36.5-26.2a14 14 0 0 0 0-23.2L148 14.2Z"
          fill="#FFCC00"
        />
      </svg>
      <span className={wordmarkClassName} style={wordmarkStyle}>
        RelatiV
      </span>
    </span>
  );
}
