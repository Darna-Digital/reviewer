/**
 * Motion tokens — pick a tier by how much moves, never a hand-written duration.
 * A tier *is* its enter transition; `.exit` is the matching leave, always a
 * quicker plain tween so a dismissal reads as final instead of the entrance
 * played backwards.
 *
 *   transition={spring.fast}
 *   exit={{ opacity: 0, transition: spring.fast.exit }}
 */
export const spring = {
  fast: {
    type: "spring" as const,
    duration: 0.08,
    bounce: 0,
    exit: { duration: 0.06 },
  },
  moderate: {
    type: "spring" as const,
    duration: 0.16,
    bounce: 0,
    exit: { duration: 0.12 },
  },
  slow: {
    type: "spring" as const,
    duration: 0.24,
    bounce: 0.12,
    exit: { duration: 0.16 },
  },
} as const;

const STALLED_ANIMATION_BUFFER_MS = 100;

/** A backgrounded tab can stall an exit animation, leaving a portal that waits
 * on `onAnimationComplete` mounted forever; this is when to unmount anyway. */
export const exitFallbackMs = (tier: { exit: { duration: number } }) =>
  Math.round(tier.exit.duration * 1000) + STALLED_ANIMATION_BUFFER_MS;
