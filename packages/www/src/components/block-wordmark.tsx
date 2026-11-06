import { BLOCK_WORDMARK } from "#/components/block-wordmark.generated";
import { cn } from "#/lib/cn";

/**
 * The name in the mark's own blocks, the artwork the Mac app rests over a new
 * chat: the letters in ink, their counters fainter beneath.
 */
export function BlockWordmark({ className }: { className?: string }) {
  return (
    <svg
      aria-label="Reviewer"
      className={cn("block h-auto w-full", className)}
      fill="currentColor"
      role="img"
      viewBox={`0 0 ${BLOCK_WORDMARK.width} ${BLOCK_WORDMARK.height}`}
    >
      <path d={BLOCK_WORDMARK.counters} fillOpacity={0.4} />
      <path d={BLOCK_WORDMARK.ink} />
    </svg>
  );
}
