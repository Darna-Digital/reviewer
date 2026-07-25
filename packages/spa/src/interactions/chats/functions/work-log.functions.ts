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
import type { ChatActivity } from "@byconvo/core/chats"

export type WorkStepStatus = "running" | "done" | "failed"

export interface WorkStep {
  readonly id: string
  readonly label: string
  readonly summary: string
  readonly status: WorkStepStatus
  readonly thinking: boolean
  /** The call's arguments, from the activity that opened it. */
  readonly input: string | null
  /** What the tool returned, from the activity that settled it. */
  readonly output: string | null
  readonly startedAt: string
  readonly endedAt: string | null
  readonly durationMs: number | null
}

const OPENING_KINDS = new Set(["tool.started", "thinking"])
const CLOSING_KINDS = new Set([
  "tool.completed",
  "tool.failed",
  "thinking.completed",
])

/** `"Bash — pnpm test"` → `"Bash"`. Providers that send an explicit `label`
 * skip this; codex only ever encodes the tool in the summary's first clause. */
const labelFrom = (activity: ChatActivity): string =>
  activity.label ?? activity.summary.split(" — ")[0] ?? activity.summary

const durationBetween = (startedAt: string, endedAt: string): number | null => {
  const ms = Date.parse(endedAt) - Date.parse(startedAt)
  return Number.isFinite(ms) && ms >= 0 ? ms : null
}

interface MutableStep {
  step: WorkStep
  callId: string | undefined
}

/**
 * @param turnRunning whether the turn is still live. When it isn't, a step with
 * no closing activity never got one (the agent was killed, or the provider
 * simply doesn't report completions) — it is shown settled rather than left
 * spinning forever.
 */
export function toWorkSteps(
  activities: ReadonlyArray<ChatActivity>,
  turnRunning: boolean
): ReadonlyArray<WorkStep> {
  const steps: MutableStep[] = []

  /** The still-open step a closing activity belongs to. Providers that send a
   * call id (claude, whose tools can overlap) match on it; those that don't
   * (codex, strictly sequential) close the oldest open id-less step. */
  const openStepFor = (activity: ChatActivity): MutableStep | undefined => {
    if (activity.callId !== undefined) {
      return steps.find(
        (s) => s.callId === activity.callId && s.step.status === "running"
      )
    }
    return steps.find(
      (s) => s.callId === undefined && s.step.status === "running"
    )
  }

  for (const activity of activities) {
    if (CLOSING_KINDS.has(activity.kind)) {
      const open = openStepFor(activity)
      const failed = activity.kind === "tool.failed" || activity.tone === "error"
      if (open === undefined) {
        // A completion with nothing to close (a reconnect that replayed only
        // the tail, or a provider that reports the end and not the start).
        steps.push({
          callId: activity.callId,
          step: {
            id: activity.id,
            label: labelFrom(activity),
            summary: activity.summary,
            status: failed ? "failed" : "done",
            thinking: activity.kind === "thinking.completed",
            input: null,
            output: activity.detail,
            startedAt: activity.createdAt,
            endedAt: activity.createdAt,
            durationMs: null,
          },
        })
        continue
      }
      open.step = {
        ...open.step,
        status: failed ? "failed" : "done",
        output: activity.detail,
        endedAt: activity.createdAt,
        durationMs: durationBetween(open.step.startedAt, activity.createdAt),
      }
      continue
    }

    const opening = OPENING_KINDS.has(activity.kind)
    steps.push({
      callId: activity.callId,
      step: {
        id: activity.id,
        label: labelFrom(activity),
        summary: activity.summary,
        // A one-off activity (codex's `error`) is already over when it arrives.
        status: opening ? "running" : activity.tone === "error" ? "failed" : "done",
        thinking: activity.kind === "thinking",
        input: activity.detail,
        output: null,
        startedAt: activity.createdAt,
        endedAt: opening ? null : activity.createdAt,
        durationMs: null,
      },
    })
  }

  return steps.map(({ step }) =>
    step.status === "running" && !turnRunning ? { ...step, status: "done" } : step
  )
}

/** The step to surface in the live status line: whatever is still in flight. */
export const activeWorkStep = (
  steps: ReadonlyArray<WorkStep>
): WorkStep | undefined => {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const step = steps[i]
    if (step !== undefined && step.status === "running") return step
  }
  return undefined
}
