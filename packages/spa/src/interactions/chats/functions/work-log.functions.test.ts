import { describe, expect, it } from "vitest"
import type { ChatActivity } from "@byconvo/core/chats"
import { activeWorkStep, toWorkSteps } from "./work-log.functions"

let seq = 0
const activity = (input: Partial<ChatActivity>): ChatActivity => {
  seq += 1
  return {
    id: `a-${seq}`,
    turnId: "turn-1",
    kind: "tool.started",
    tone: "tool",
    summary: "Bash — pnpm test",
    detail: null,
    createdAt: "2026-07-25T12:00:00.000Z",
    ...input,
  }
}

describe("toWorkSteps", () => {
  it("folds a tool's start and completion into one step with both payloads", () => {
    const steps = toWorkSteps(
      [
        activity({
          kind: "tool.started",
          callId: "tu-1",
          label: "Bash",
          detail: '{"command":"pnpm test"}',
          createdAt: "2026-07-25T12:00:00.000Z",
        }),
        activity({
          kind: "tool.completed",
          callId: "tu-1",
          label: "Bash",
          summary: "Bash finished",
          detail: "51 passed",
          createdAt: "2026-07-25T12:00:02.500Z",
        }),
      ],
      false
    )
    expect(steps).toHaveLength(1)
    expect(steps[0]).toMatchObject({
      label: "Bash",
      summary: "Bash — pnpm test",
      status: "done",
      input: '{"command":"pnpm test"}',
      output: "51 passed",
      durationMs: 2500,
    })
  })

  it("pairs overlapping tool calls by call id, not by arrival order", () => {
    const steps = toWorkSteps(
      [
        activity({ kind: "tool.started", callId: "a", label: "Read" }),
        activity({ kind: "tool.started", callId: "b", label: "Bash" }),
        activity({
          kind: "tool.failed",
          callId: "b",
          label: "Bash",
          tone: "error",
          detail: "exit 1",
        }),
      ],
      true
    )
    expect(steps.map((s) => [s.label, s.status])).toEqual([
      ["Read", "running"],
      ["Bash", "failed"],
    ])
    expect(steps[1]?.output).toBe("exit 1")
  })

  it("closes the oldest open step when a provider sends no call ids", () => {
    // codex reports "Command — ls" then "Command finished", with no id linking
    // them, and only ever runs one command at a time.
    const steps = toWorkSteps(
      [
        activity({ kind: "tool.started", summary: "Command — ls" }),
        activity({ kind: "tool.completed", summary: "Command finished" }),
        activity({ kind: "tool.started", summary: "Command — pwd" }),
      ],
      true
    )
    expect(steps.map((s) => [s.summary, s.status])).toEqual([
      ["Command — ls", "done"],
      ["Command — pwd", "running"],
    ])
    // The label falls out of the summary when the provider sends none.
    expect(steps[0]?.label).toBe("Command")
  })

  it("settles steps left open when the turn is no longer running", () => {
    const open = [activity({ kind: "tool.started", callId: "tu-1" })]
    expect(toWorkSteps(open, true)[0]?.status).toBe("running")
    expect(toWorkSteps(open, false)[0]?.status).toBe("done")
  })

  it("keeps a completion whose start was never seen", () => {
    const steps = toWorkSteps(
      [
        activity({
          kind: "tool.completed",
          callId: "tu-9",
          label: "Grep",
          summary: "Grep finished",
          detail: "3 matches",
        }),
      ],
      true
    )
    expect(steps).toMatchObject([
      { label: "Grep", status: "done", input: null, output: "3 matches" },
    ])
  })

  it("carries thinking through as a step holding the reasoning text", () => {
    const steps = toWorkSteps(
      [
        activity({
          kind: "thinking",
          tone: "info",
          summary: "Thinking",
          label: "Thinking",
          callId: "think-1",
        }),
        activity({
          kind: "thinking.completed",
          tone: "info",
          summary: "Thought",
          label: "Thinking",
          callId: "think-1",
          detail: "weigh the options",
        }),
      ],
      true
    )
    expect(steps).toMatchObject([
      { thinking: true, status: "done", output: "weigh the options" },
    ])
  })

  it("treats a standalone error activity as an already-failed step", () => {
    const steps = toWorkSteps(
      [activity({ kind: "error", tone: "error", summary: "sandbox denied" })],
      true
    )
    expect(steps).toMatchObject([
      { status: "failed", summary: "sandbox denied" },
    ])
  })
})

describe("activeWorkStep", () => {
  it("is the most recent step still running", () => {
    const steps = toWorkSteps(
      [
        activity({ kind: "tool.started", callId: "a", label: "Read" }),
        activity({ kind: "tool.completed", callId: "a", label: "Read" }),
        activity({ kind: "tool.started", callId: "b", label: "Bash" }),
      ],
      true
    )
    expect(activeWorkStep(steps)?.label).toBe("Bash")
  })

  it("is undefined once everything has settled", () => {
    const steps = toWorkSteps(
      [activity({ kind: "tool.started", callId: "a" })],
      false
    )
    expect(activeWorkStep(steps)).toBeUndefined()
  })
})
