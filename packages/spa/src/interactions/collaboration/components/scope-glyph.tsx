import {
  IconCalendarMonth,
  IconCalendarStats,
  IconCalendarWeek,
  IconCircleOff,
  IconHourglass,
  IconSun,
} from "@tabler/icons-react";
import type { ScopeKind } from "@/interactions/collaboration/data/collaboration.mock";
import { cn } from "@/lib/utils";

const ICON = {
  day: IconSun,
  week: IconCalendarWeek,
  duration: IconHourglass,
  month: IconCalendarMonth,
  quarter: IconCalendarStats,
  out: IconCircleOff,
};

/**
 * Horizons warm as they narrow: today is the closest thing to now, out of scope
 * has no temperature at all.
 */
const COLOR: Record<ScopeKind, string> = {
  day: "text-orange-600 dark:text-orange-400",
  week: "text-brand-600 dark:text-brand-400",
  duration: "text-teal-600 dark:text-teal-400",
  month: "text-muted-foreground",
  quarter: "text-muted-foreground/80",
  out: "text-muted-foreground/60",
};

export const SCOPE_TINT: Record<ScopeKind, string> = {
  day: "bg-orange-500/5",
  week: "bg-brand-500/5",
  duration: "bg-teal-500/5",
  month: "bg-muted/40",
  quarter: "bg-muted/25",
  out: "bg-transparent",
};

export const SCOPE_RAIL: Record<ScopeKind, string> = {
  day: "bg-orange-500/70",
  week: "bg-brand-500/70",
  duration: "bg-teal-500/70",
  month: "bg-muted-foreground/40",
  quarter: "bg-muted-foreground/30",
  out: "bg-transparent",
};

export function ScopeGlyph({
  kind,
  className,
}: {
  kind: ScopeKind;
  className?: string;
}) {
  const Icon = ICON[kind];
  return <Icon className={cn("size-4 shrink-0", COLOR[kind], className)} />;
}
