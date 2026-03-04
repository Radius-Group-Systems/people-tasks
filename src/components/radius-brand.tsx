"use client";

import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════
   RADIUS BRAND COMPONENTS
   Wordmark, Icon Mark, and Glow Arc decorative elements
   ═══════════════════════════════════════════════════════════════ */

// ── RadiusWordmark ─────────────────────────────────────────────
// Renders the "radius" + optional sub-brand text treatment
// Uses CSS to replicate the brand typography

interface RadiusWordmarkProps {
  subBrand?: "GROUP" | "OPERATIONS" | null;
  variant?: "horizontal" | "stack";
  colorMode?: "dark" | "light"; // dark = dark text on light bg, light = white text on dark bg
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const wordmarkSizes = {
  sm: { brand: "text-xl", sub: "text-[0.625rem]", gap: "gap-1" },
  md: { brand: "text-2xl", sub: "text-sm", gap: "gap-1.5" },
  lg: { brand: "text-4xl", sub: "text-lg", gap: "gap-2" },
  xl: { brand: "text-5xl", sub: "text-xl", gap: "gap-2.5" },
};

export function RadiusWordmark({
  subBrand = null,
  variant = "horizontal",
  colorMode = "dark",
  size = "md",
  className,
}: RadiusWordmarkProps) {
  const s = wordmarkSizes[size];
  const isStack = variant === "stack";
  const textColor = colorMode === "dark" ? "text-[#252525]" : "text-white";

  return (
    <div
      className={cn(
        "flex",
        isStack ? "flex-col items-center" : "flex-row items-baseline",
        isStack ? s.gap : "gap-[0.5em]",
        className
      )}
    >
      <span
        className={cn(
          "font-brand leading-none font-normal",
          s.brand,
          textColor
        )}
      >
        radius
      </span>
      {subBrand && (
        <span className={cn("font-sub-brand leading-none text-stone-accent", s.sub)}>
          {subBrand}
        </span>
      )}
    </div>
  );
}

// ── RadiusIconMark ─────────────────────────────────────────────
// SVG recreation of the stylized "r" icon with half-circle accent

interface RadiusIconMarkProps {
  colorMode?: "dark" | "light";
  size?: number;
  className?: string;
}

export function RadiusIconMark({
  colorMode = "dark",
  size = 32,
  className,
}: RadiusIconMarkProps) {
  const primary = colorMode === "dark" ? "#252525" : "#FFFFFF";
  const accent = "#91918B";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
    >
      {/* Left vertical + curved top arm of the "r" */}
      <path
        d="M12 12v24M12 12c0 0 0-0 8-0c6 0 10 4 10 10"
        stroke={primary}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Half-circle accent — the "radius" geometric motif */}
      <path
        d="M30 22a12 12 0 0 1 0 24"
        stroke={accent}
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
        opacity="0.9"
      />
      {/* Diagonal split accent on the half-circle */}
      <line
        x1="30"
        y1="22"
        x2="30"
        y2="46"
        stroke={accent}
        strokeWidth="1.5"
        opacity="0.4"
      />
    </svg>
  );
}

// ── RadiusGlowArc ──────────────────────────────────────────────
// Decorative concentric white arcs inspired by full-page brand assets

interface RadiusGlowArcProps {
  opacity?: number;
  size?: number;
  className?: string;
  delay?: number; // animation delay in ms
}

export function RadiusGlowArc({
  opacity = 0.12,
  size = 600,
  className,
  delay = 0,
}: RadiusGlowArcProps) {
  return (
    <div
      className={cn("absolute pointer-events-none", className)}
      style={{
        bottom: `${-size * 0.4}px`,
        right: `${-size * 0.3}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        border: `2px solid rgba(255, 255, 255, 0.6)`,
        boxShadow: `
          0 0 ${size * 0.1}px rgba(255, 255, 255, ${opacity}),
          inset 0 0 ${size * 0.05}px rgba(255, 255, 255, ${opacity * 0.5})
        `,
        animation: `radius-arc-expand 1s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms both,
                    radius-glow-pulse 6s ease-in-out ${delay + 1000}ms infinite`,
      }}
    >
      {/* Inner concentric arc */}
      <div
        className="absolute rounded-full"
        style={{
          top: "12%",
          left: "12%",
          width: "76%",
          height: "76%",
          border: "1.5px solid rgba(255, 255, 255, 0.35)",
        }}
      />
      {/* Innermost arc */}
      <div
        className="absolute rounded-full"
        style={{
          top: "28%",
          left: "28%",
          width: "44%",
          height: "44%",
          border: "1px solid rgba(255, 255, 255, 0.18)",
        }}
      />
    </div>
  );
}
