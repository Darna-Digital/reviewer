/**
 * Static lookup tables for the surface ladder (see `styles.css`).
 *
 * Tailwind's scanner only emits utilities for literal strings it finds in
 * source, so a template literal like `bg-surface-${level}` compiles to nothing
 * and the element renders transparent. Every level is spelled out below.
 */

const BASE_SURFACE = 1;
const TOP_SURFACE = 8;

const SURFACE_BG: Record<number, string> = {
  1: "bg-surface-1",
  2: "bg-surface-2",
  3: "bg-surface-3",
  4: "bg-surface-4",
  5: "bg-surface-5",
  6: "bg-surface-6",
  7: "bg-surface-7",
  8: "bg-surface-8",
};

const SURFACE_SHADOW: Record<number, string> = {
  1: "shadow-surface-1",
  2: "shadow-surface-2",
  3: "shadow-surface-3",
  4: "shadow-surface-4",
  5: "shadow-surface-5",
  6: "shadow-surface-6",
  7: "shadow-surface-7",
  8: "shadow-surface-8",
};

const clampLevel = (level: number) =>
  Math.round(Math.max(BASE_SURFACE, Math.min(TOP_SURFACE, level)));

function surfaceBackground(level: number): string {
  return SURFACE_BG[clampLevel(level)];
}

function surfaceClasses(
  bgLevel: number,
  shadowLevel: number = bgLevel
): string {
  return `${SURFACE_BG[clampLevel(bgLevel)]} ${SURFACE_SHADOW[clampLevel(shadowLevel)]}`;
}

export {
  BASE_SURFACE,
  TOP_SURFACE,
  SURFACE_BG,
  SURFACE_SHADOW,
  clampLevel,
  surfaceBackground,
  surfaceClasses,
};
