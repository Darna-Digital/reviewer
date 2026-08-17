/**
 * The mark an agent wears while it is working: a 3×3 lattice of dots with a
 * swell crossing it on the diagonal.
 *
 * This is the "S2" orb from aicss.dev/components/orbs. Every cell runs the one
 * wave; what makes it a sweep rather than a pulse is the phase shift, and what
 * makes the sweep continuous is that the shift across the grid (1500ms) is
 * close to the wave's own length (1700ms) — the far corner restarts as the near
 * one does. The geometry is tuned on a 28px stage and scaled to `size` by
 * `--orb-k`, so the dots keep their proportion at any size.
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const GRID = 3;
const PITCH = 6;
const STAGE = 28;
const SWEEP_MS = 1500;

const CELLS = Array.from({ length: GRID * GRID }, (_, at) => {
  const x = at % GRID;
  const y = Math.floor(at / GRID);
  return {
    key: `${x},${y}`,
    left: x * PITCH,
    top: y * PITCH,
    delay: ((x + y) / (2 * (GRID - 1))) * SWEEP_MS,
  };
});

export function Orb({
  size = 20,
  label,
  className,
}: {
  readonly size?: number;
  /** Announces the wait. Omit where neighbouring copy already names it. */
  readonly label?: string;
  readonly className?: string;
}) {
  return (
    <span
      role={label === undefined ? undefined : "img"}
      aria-label={label}
      aria-hidden={label === undefined ? true : undefined}
      className={cn("orb", className)}
      style={
        { width: size, height: size, "--orb-k": size / STAGE } as CSSProperties
      }
    >
      <span className="orb-lattice">
        {CELLS.map((cell) => (
          <span
            key={cell.key}
            className="orb-cell"
            style={{
              left: cell.left,
              top: cell.top,
              animationDelay: `${cell.delay}ms`,
            }}
          />
        ))}
      </span>
    </span>
  );
}
