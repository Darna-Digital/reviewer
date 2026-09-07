/**
 * The two things a reviewer reads off a pull request before opening it: did CI
 * pass, and is anything in the way of merging it.
 *
 * They live together, and apart from both places that draw them — the picker's
 * rows and the pane's header — because the pair has to read the same in both.
 * A tick meaning "passing" in one column and "mergeable" in the other is how a
 * status light stops being trusted.
 */
import {
  IconAlertTriangleFilled,
  IconCircleCheckFilled,
  IconCircleDashed,
  IconCircleXFilled,
  IconProgress,
} from "@tabler/icons-react";
import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  blockedReason,
  checksState,
  checksSummary,
} from "@/components/git/pull-requests.functions";
import { cn } from "@/lib/utils";
import type {
  CheckState,
  PullRequestInfo,
} from "@reviewer/core/ports/git-provider";

const CHECK_ICON = {
  success: IconCircleCheckFilled,
  failure: IconCircleXFilled,
  pending: IconProgress,
  neutral: IconCircleDashed,
} as const satisfies Record<CheckState, typeof IconCircleCheckFilled>;

const CHECK_TONE = {
  success: "text-emerald-600 dark:text-emerald-400",
  failure: "text-destructive",
  // Spun rather than merely coloured: "still running" is the one of these four
  // that will change on its own, and a still icon reads as a settled verdict.
  pending:
    "animate-[spin_2.4s_linear_infinite] text-amber-600 dark:text-amber-400",
  neutral: "text-muted-foreground",
} as const satisfies Record<CheckState, string>;

/** A hover explanation over any glyph, without giving it a focus ring. */
function Hint({ text, children }: { text: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span className="inline-flex items-center" aria-label={text} />}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

/** CI on the head commit. Renders nothing when the repo runs no checks. */
export function ChecksIcon({
  pull,
  className,
}: {
  pull: PullRequestInfo;
  className?: string;
}) {
  const state = checksState(pull);
  const summary = checksSummary(pull);
  if (state === null || summary === null) return null;
  const Icon = CHECK_ICON[state];
  return (
    <Hint text={summary}>
      <Icon className={cn("size-3.5 shrink-0", CHECK_TONE[state], className)} />
    </Hint>
  );
}

/**
 * The blocker. Absent — not greyed out — when nothing is blocking: an icon that
 * is always there is an icon nobody looks at, and this one has to be noticed.
 */
export function BlockedIcon({
  pull,
  className,
}: {
  pull: PullRequestInfo;
  className?: string;
}) {
  const reason = blockedReason(pull);
  if (reason === null) return null;
  return (
    <Hint text={reason}>
      <IconAlertTriangleFilled
        className={cn(
          "size-3.5 shrink-0 text-amber-600 dark:text-amber-400",
          className
        )}
      />
    </Hint>
  );
}
