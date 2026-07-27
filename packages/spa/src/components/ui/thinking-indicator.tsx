/**
 * The "an agent is working" indicator: a glyph that morphs between a circle and
 * an infinity loop, beside a shimmering label.
 *
 * Adapted from fluidfunctionalism.com/docs/thinking-indicator. The original
 * drives both animations with framer-motion; this port runs the path morph as
 * SMIL and the label swap as CSS, so it needs no animation library.
 *
 * Pass `label` to name the work actually in flight ("Bash — pnpm test"). With
 * no label it cycles generic words, which is the honest rendering for the
 * stretch where the model is generating and there is nothing else to report.
 */
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

// All three share one command sequence (M, four C, Z), which is what lets SMIL
// interpolate between them — a mismatched structure would just cut.
const CIRCLE_A =
  "M 12 8 C 14.21 8 16 9.79 16 12 C 16 14.21 14.21 16 12 16 C 9.79 16 8 14.21 8 12 C 8 9.79 9.79 8 12 8 Z"
const INFINITY_LOOP =
  "M 12 12 C 14 8.5 19 8.5 19 12 C 19 15.5 14 15.5 12 12 C 10 8.5 5 8.5 5 12 C 5 15.5 10 15.5 12 12 Z"
const CIRCLE_B =
  "M 12 16 C 14.21 16 16 14.21 16 12 C 16 9.79 14.21 8 12 8 C 9.79 8 8 9.79 8 12 C 8 14.21 9.79 16 12 16 Z"

const IDLE_WORDS = ["Thinking", "Working", "Reasoning", "Composing"]
const WORD_MS = 4000
const LONGEST_IDLE_WORD = IDLE_WORDS.reduce((a, b) =>
  a.length >= b.length ? a : b
)

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduced(query.matches)
    sync()
    query.addEventListener("change", sync)
    return () => query.removeEventListener("change", sync)
  }, [])
  return reduced
}

export function ThinkingIndicator({
  label,
  showIcon = true,
  className,
}: {
  readonly label?: string
  readonly showIcon?: boolean
  readonly className?: string
}) {
  const reduced = usePrefersReducedMotion()
  const cycling = label === undefined
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!cycling || reduced) return
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % IDLE_WORDS.length),
      WORD_MS
    )
    return () => clearInterval(timer)
  }, [cycling, reduced])

  const word = cycling ? (IDLE_WORDS[reduced ? 0 : index] ?? "") : label

  return (
    <div role="status" className={cn("flex items-center gap-2", className)}>
      {/* One static announcement — the visible label is aria-hidden so a screen
          reader isn't re-interrupted every time the word or the tool changes. */}
      <span className="sr-only">Working…</span>
      {showIcon && (
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4 shrink-0 text-muted-foreground"
        >
          <path d={reduced ? INFINITY_LOOP : CIRCLE_A}>
            {!reduced && (
              <animate
                attributeName="d"
                dur="6s"
                repeatCount="indefinite"
                keyTimes="0;0.25;0.5;0.75;1"
                calcMode="spline"
                keySplines="0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1;0.4 0 0.2 1"
                values={`${CIRCLE_A};${INFINITY_LOOP};${CIRCLE_B};${INFINITY_LOOP};${CIRCLE_A}`}
              />
            )}
          </path>
        </svg>
      )}
      <span
        aria-hidden
        className="inline-grid min-w-0 overflow-hidden text-xs font-medium"
      >
        {/* While cycling, an invisible copy of the longest word holds the width
            so the row doesn't jitter as words swap. A caller-supplied label is
            arbitrary length, so it sizes itself and truncates instead. */}
        {cycling && (
          <span className="invisible col-start-1 row-start-1 whitespace-nowrap">
            {LONGEST_IDLE_WORD}
          </span>
        )}
        <span
          key={word}
          className="shimmer-text col-start-1 row-start-1 animate-in truncate duration-200 fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
        >
          {word}
        </span>
      </span>
    </div>
  )
}
