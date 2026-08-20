/**
 * A to-do's due date, or nothing at all.
 *
 * Dated work is the only thing on these surfaces that makes a claim about the
 * world outside the list, so it is the only thing that gets to change colour:
 * overdue reads as overdue, and everything else is a quiet date.
 */
import { cn } from "@/lib/utils";

const FORMAT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

/** Today as `YYYY-MM-DD` in the reader's own zone, which is what a date means. */
const today = (): string => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

export function TodoDue({ dueOn }: { readonly dueOn: string }) {
  if (dueOn.length === 0) return null;
  // Parsed as local noon rather than midnight UTC: `new Date("2026-09-01")` is
  // UTC, which in a western zone is the evening of August 31st — a date that
  // reads a day early is worse than no date.
  const parsed = new Date(`${dueOn}T12:00:00`);
  const label = Number.isNaN(parsed.getTime()) ? dueOn : FORMAT.format(parsed);
  return (
    <span
      className={cn(
        "shrink-0 text-[0.6875rem] tabular-nums",
        dueOn < today() ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}
