/**
 * The mark an agent wears while it is working: a 3×3 lattice of dots with a
 * swell crossing it on the diagonal.
 *
 * This is the "S2" orb from aicss.dev/components/orbs. Every cell runs the one
 * wave; what makes it a sweep rather than a pulse is the phase shift. The five
 * diagonals are spread over the whole period rather than across it, so the
 * corner-to-corner crest and the wrap back to the near corner are the same
 * beat and the rhythm never hitches. Shifts are negative, so a freshly mounted
 * orb is already mid-sweep instead of building its first wave from rest. The
 * geometry is tuned on a 28px stage and scaled to `size` by `--orb-k`, so the
 * dots keep their proportion at any size.
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const GRID = 3;
const PITCH = 6;
const STAGE = 28;
const PERIOD_MS = 1700;
const DIAGONALS = 2 * (GRID - 1) + 1;

const CELLS = Array.from({ length: GRID * GRID }, (_, at) => {
  const x = at % GRID;
  const y = Math.floor(at / GRID);
  const diagonal = x + y;
  return {
    key: `${x},${y}`,
    left: x * PITCH,
    top: y * PITCH,
    shift: ((DIAGONALS - 1 - diagonal) / DIAGONALS) * PERIOD_MS,
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
        {
          width: size,
          height: size,
          "--orb-k": size / STAGE,
          "--orb-period": `${PERIOD_MS}ms`,
        } as CSSProperties
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
              animationDelay: `${-cell.shift}ms`,
            }}
          />
        ))}
      </span>
    </span>
  );
}
