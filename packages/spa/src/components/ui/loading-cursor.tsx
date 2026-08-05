/**
 * Linear-style loading indicator: a typing caret that blinks on/off.
 * Prefer this over spinners or "Loading…" copy for in-pane wait states.
 */
import { cn } from "@/lib/utils";

export function LoadingCursor({
  label = "Loading…",
  className,
}: {
  /** `null` when neighbouring copy already names the wait — see below. */
  readonly label?: string | null;
  /** Styles the caret itself, so it can take the colour of a filled button. */
  readonly className?: string;
}) {
  const caret = (
    <span
      aria-hidden
      className={cn(
        "loading-cursor inline-block h-3.5 w-1 rounded-[1px] bg-foreground",
        className
      )}
    />
  );
  // Beside visible text that already reads "Generating…", the caret is pure
  // decoration; announcing it again would say the same thing twice.
  if (label === null) return caret;
  return (
    <span role="status" className="inline-flex items-center">
      <span className="sr-only">{label}</span>
      {caret}
    </span>
  );
}
