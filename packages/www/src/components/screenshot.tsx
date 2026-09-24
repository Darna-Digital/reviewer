import type { CSSProperties } from "react";

import { cn } from "#/lib/cn";

/**
 * Soft mesh gradients standing in for screenshots that haven't been taken yet.
 * Each is three colour blooms over a base, so neighbouring cards stay distinct.
 */
const TONES = {
  dawn: ["#fbd3e9", "#bb9bf1", "#ffe3b3", "#f6eefc"],
  lagoon: ["#a8e6f0", "#7fa8ff", "#c7f5d9", "#eef6fb"],
  citrus: ["#ffe29a", "#ff9f7a", "#fff3c4", "#fff8ec"],
  meadow: ["#c3f0c8", "#6fd3b0", "#e8f7b8", "#f1faf2"],
  dusk: ["#c9b6ff", "#ff9ec7", "#9fc3ff", "#f3f0ff"],
  ember: ["#ffc2a8", "#ff7a8a", "#ffd9a0", "#fff1ec"],
  glacier: ["#cfe3ff", "#a0b4ff", "#d8f4ff", "#f2f6ff"],
  orchid: ["#f5c1ff", "#9fa6ff", "#ffd1e3", "#faf1ff"],
} as const;

export type ScreenshotTone = keyof typeof TONES;

function meshGradient(tone: ScreenshotTone): CSSProperties {
  const [first, second, third, base] = TONES[tone];
  return {
    backgroundColor: base,
    backgroundImage: [
      `radial-gradient(at 12% 18%, ${first} 0, transparent 55%)`,
      `radial-gradient(at 88% 30%, ${second} 0, transparent 50%)`,
      `radial-gradient(at 45% 95%, ${third} 0, transparent 60%)`,
    ].join(", "),
  };
}

/**
 * An app screenshot at a fixed aspect ratio. Without a `src` it renders a
 * gradient placeholder labelled with what belongs there.
 */
export function Screenshot({
  alt,
  className,
  height,
  src,
  tone,
  width,
}: {
  alt: string;
  className?: string;
  height: number;
  src?: string;
  tone: ScreenshotTone;
  width: number;
}) {
  const box = cn("block h-auto w-full", className);

  if (src) {
    return (
      <img alt={alt} className={box} height={height} src={src} width={width} />
    );
  }

  return (
    <div
      aria-label={alt}
      className={cn(
        box,
        "flex items-start justify-center pt-[12%] dark:opacity-80"
      )}
      role="img"
      style={{ aspectRatio: `${width} / ${height}`, ...meshGradient(tone) }}
    >
      <span className="max-w-sm px-6 text-center text-[13px] font-medium text-pretty text-neutral-900/40">
        {alt}
      </span>
    </div>
  );
}
