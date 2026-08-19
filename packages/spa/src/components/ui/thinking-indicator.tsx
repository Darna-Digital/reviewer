/**
 * The "an agent is working" indicator: the orb beside a shimmering label.
 *
 * Pass `label` to name the work actually in flight ("Bash — pnpm test"). With
 * no label it cycles generic words, which is the honest rendering for the
 * stretch where the model is generating and there is nothing else to report.
 */
import { useEffect, useState } from "react";
import { Orb } from "@/components/ui/orb";
import { cn } from "@/lib/utils";

const IDLE_WORDS = ["Thinking", "Working", "Reasoning", "Composing"];
const WORD_MS = 4000;
const LONGEST_IDLE_WORD = IDLE_WORDS.reduce((a, b) =>
  a.length >= b.length ? a : b
);

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export function ThinkingIndicator({
  label,
  showIcon = true,
  className,
}: {
  readonly label?: string;
  readonly showIcon?: boolean;
  readonly className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const cycling = label === undefined;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!cycling || reduced) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % IDLE_WORDS.length),
      WORD_MS
    );
    return () => clearInterval(timer);
  }, [cycling, reduced]);

  const word = cycling ? (IDLE_WORDS[reduced ? 0 : index] ?? "") : label;

  return (
    <div role="status" className={cn("flex items-center gap-2", className)}>
      {/* One static announcement — the visible label is aria-hidden so a screen
          reader isn't re-interrupted every time the word or the tool changes. */}
      <span className="sr-only">Working…</span>
      {showIcon && <Orb size={16} />}
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
  );
}
