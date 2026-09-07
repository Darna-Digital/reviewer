/**
 * Folds a turn's flat activity log into the steps the timeline draws.
 *
 * The wire carries a tool call as two independent activities — one when it
 * starts, one when it settles — because that is how every provider CLI reports
 * it. Rendering them as two rows makes a turn read like twice as much work as
 * it did and hides the outcome behind a separate line, so they are paired here
 * into a single step that owns a status, a duration, and both payloads.
 *
 * Pure, so the pairing rules (which are the fiddly part) are unit-testable
 * without a socket or a running agent.
 */
import type { ChatActivity } from "@reviewer/core/chats";

export type WorkStepStatus = "running" | "done" | "failed";

export interface WorkStep {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  /** The part of the summary after the tool name, which the label already
   * shows — `"Bash — pnpm test"` → `"pnpm test"`. */
  readonly detail: string | null;
  readonly status: WorkStepStatus;
  readonly thinking: boolean;
  /** The call's arguments, from the activity that opened it. */
  readonly input: string | null;
  /** What the tool returned, from the activity that settled it. */
  readonly output: string | null;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly durationMs: number | null;
}

const OPENING_KINDS = new Set(["tool.started", "thinking"]);
const CLOSING_KINDS = new Set([
  "tool.completed",
  "tool.failed",
  "thinking.completed",
]);

/** `"Bash — pnpm test"` → `"Bash"`. Providers that send an explicit `label`
 * skip this; codex only ever encodes the tool in the summary's first clause. */
const labelFrom = (activity: ChatActivity): string =>
  activity.label ?? activity.summary.split(" — ")[0] ?? activity.summary;

const detailFrom = (activity: ChatActivity): string | null => {
  const tail = activity.summary.split(" — ").slice(1).join(" — ");
  return tail.length > 0 ? tail : null;
};

const durationBetween = (startedAt: string, endedAt: string): number | null => {
  const ms = Date.parse(endedAt) - Date.parse(startedAt);
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
};

interface MutableStep {
  step: WorkStep;
  callId: string | undefined;
}

const isFailure = (activity: ChatActivity): boolean =>
  activity.kind === "tool.failed" || activity.tone === "error";

const alreadySettledOnArrival = (activity: ChatActivity): boolean =>
  !OPENING_KINDS.has(activity.kind);

const asAlreadyClosedStep = (activity: ChatActivity): MutableStep => ({
  callId: activity.callId,
  step: {
    id: activity.id,
    label: labelFrom(activity),
    summary: activity.summary,
    detail: detailFrom(activity),
    status: isFailure(activity) ? "failed" : "done",
    thinking: activity.kind === "thinking.completed",
    input: null,
    output: activity.detail,
    startedAt: activity.createdAt,
    endedAt: activity.createdAt,
    durationMs: null,
  },
});

const asOpeningStep = (activity: ChatActivity): MutableStep => {
  const settled = alreadySettledOnArrival(activity);
  return {
    callId: activity.callId,
    step: {
      id: activity.id,
      label: labelFrom(activity),
      summary: activity.summary,
      detail: detailFrom(activity),
      status: !settled ? "running" : isFailure(activity) ? "failed" : "done",
      thinking: activity.kind === "thinking",
      input: activity.detail,
      output: null,
      startedAt: activity.createdAt,
      endedAt: settled ? activity.createdAt : null,
      durationMs: null,
    },
  };
};

const closedBy = (open: WorkStep, activity: ChatActivity): WorkStep => ({
  ...open,
  status: isFailure(activity) ? "failed" : "done",
  output: activity.detail,
  endedAt: activity.createdAt,
  durationMs: durationBetween(open.startedAt, activity.createdAt),
});

/**
 * @param turnRunning when false, a step with no closing activity never got one
 * (the agent was killed, or the provider doesn't report completions) — it is
 * shown settled rather than left spinning forever.
 */
export function toWorkSteps(
  activities: ReadonlyArray<ChatActivity>,
  turnRunning: boolean
): ReadonlyArray<WorkStep> {
  const steps: MutableStep[] = [];

  /** Providers that send a call id (claude, whose tools overlap) match on it;
   * those that don't (codex, strictly sequential) close the oldest open step
   * of the same kind, so a tool result can never settle a thinking block. */
  const openStepFor = (activity: ChatActivity): MutableStep | undefined => {
    if (activity.callId !== undefined) {
      return steps.find(
        (s) => s.callId === activity.callId && s.step.status === "running"
      );
    }
    const closesThinking = activity.kind === "thinking.completed";
    return steps.find(
      (s) =>
        s.callId === undefined &&
        s.step.status === "running" &&
        s.step.thinking === closesThinking
    );
  };

  for (const activity of activities) {
    if (!CLOSING_KINDS.has(activity.kind)) {
      steps.push(asOpeningStep(activity));
      continue;
    }
    const open = openStepFor(activity);
    if (open === undefined) {
      steps.push(asAlreadyClosedStep(activity));
      continue;
    }
    open.step = closedBy(open.step, activity);
  }

  return steps.map(({ step }) =>
    step.status === "running" && !turnRunning
      ? { ...step, status: "done" }
      : step
  );
}

/** The step to surface in the live status line: whatever is still in flight. */
export const activeWorkStep = (
  steps: ReadonlyArray<WorkStep>
): WorkStep | undefined => {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i];
    if (step !== undefined && step.status === "running") return step;
  }
  return undefined;
};

/**
 * Wall-clock span of the whole turn, first start to last settle. Summing the
 * steps' own durations would double-count overlapping tool calls and miss the
 * gaps between them.
 */
export const elapsedMs = (steps: ReadonlyArray<WorkStep>): number | null => {
  let first: number | null = null;
  let last: number | null = null;
  for (const step of steps) {
    const startedAt = Date.parse(step.startedAt);
    const endedAt = Date.parse(step.endedAt ?? step.startedAt);
    if (Number.isFinite(startedAt) && (first === null || startedAt < first)) {
      first = startedAt;
    }
    if (Number.isFinite(endedAt) && (last === null || endedAt > last)) {
      last = endedAt;
    }
  }
  return first === null || last === null || last < first ? null : last - first;
};
