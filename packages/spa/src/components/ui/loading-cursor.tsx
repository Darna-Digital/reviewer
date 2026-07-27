/**
 * Linear-style loading indicator: a typing caret that blinks on/off.
 * Prefer this over spinners or "Loading…" copy for in-pane wait states.
 */
import { cn } from "@/lib/utils"

export function LoadingCursor({
  label = "Loading…",
  className,
}: {
  readonly label?: string
  readonly className?: string
}) {
  return (
    <div role="status" className={cn("inline-flex items-center", className)}>
      <span className="sr-only">{label}</span>
      <span
        aria-hidden
        className="loading-cursor inline-block h-3.5 w-1 rounded-[1px] bg-foreground"
      />
    </div>
  )
}
