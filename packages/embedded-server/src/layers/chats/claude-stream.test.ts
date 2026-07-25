import { describe, expect, it } from "vitest"
import {
  CLAUDE_LOGIN_HINT,
  createClaudeTurnParser,
  type ClaudeStreamEvent,
} from "./claude-stream.ts"

const line = (value: unknown) => JSON.stringify(value)

const init = line({
  type: "system",
  subtype: "init",
  session_id: "sess-1",
  model: "claude-opus-4-8",
})

const textDelta = (text: string) =>
  line({
    type: "stream_event",
    event: {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text },
    },
  })

const assistantMessage = (content: unknown[]) =>
  line({ type: "assistant", message: { role: "assistant", content } })

const result = (overrides: Record<string, unknown> = {}) =>
  line({
    type: "result",
    subtype: "success",
    is_error: false,
    result: "done",
    total_cost_usd: 0.42,
    session_id: "sess-1",
    ...overrides,
  })

const push = (
  parser: ReturnType<typeof createClaudeTurnParser>,
  lines: string[]
): ClaudeStreamEvent[] => lines.flatMap((l) => [...parser.push(l)])

describe("createClaudeTurnParser", () => {
  it("captures the session id from the init line", () => {
    const parser = createClaudeTurnParser()
    expect(parser.push(init)).toEqual([
      { type: "session", sessionId: "sess-1" },
    ])
  })

  it("streams text deltas and assembles the message text", () => {
    const parser = createClaudeTurnParser()
    const events = push(parser, [init, textDelta("Hey"), textDelta("! Hi.")])
    const deltas = events.filter((e) => e.type === "delta")
    expect(deltas.map((d) => d.text)).toEqual(["Hey", "! Hi."])
    expect(parser.text()).toBe("Hey! Hi.")
  })

  it("does not double-append the complete assistant text after deltas", () => {
    const parser = createClaudeTurnParser()
    push(parser, [
      textDelta("Hello"),
      assistantMessage([{ type: "text", text: "Hello" }]),
    ])
    expect(parser.text()).toBe("Hello")
  })

  it("falls back to complete assistant text when no partials stream", () => {
    const parser = createClaudeTurnParser()
    const events = push(parser, [
      assistantMessage([{ type: "text", text: "No partials here." }]),
    ])
    expect(events).toEqual([{ type: "delta", text: "No partials here." }])
    expect(parser.text()).toBe("No partials here.")
  })

  it("separates assistant messages around a tool round-trip", () => {
    const parser = createClaudeTurnParser()
    push(parser, [
      textDelta("Let me check."),
      assistantMessage([
        { type: "text", text: "Let me check." },
        {
          type: "tool_use",
          id: "tu-1",
          name: "Bash",
          input: { command: "ls -la" },
        },
      ]),
      line({
        type: "user",
        message: {
          content: [{ type: "tool_result", tool_use_id: "tu-1" }],
        },
      }),
      textDelta("Found it."),
    ])
    expect(parser.text()).toBe("Let me check.\n\nFound it.")
  })

  it("emits tool activities with a telling summary and matched result", () => {
    const parser = createClaudeTurnParser()
    const events = push(parser, [
      assistantMessage([
        {
          type: "tool_use",
          id: "tu-1",
          name: "Bash",
          input: { command: "pnpm test" },
        },
      ]),
      line({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tu-1",
              is_error: true,
              content: "command not found: pnpm",
            },
          ],
        },
      }),
    ])
    const activities = events.filter((e) => e.type === "activity")
    expect(activities).toEqual([
      {
        type: "activity",
        kind: "tool.started",
        tone: "tool",
        summary: "Bash — pnpm test",
        detail: '{\n  "command": "pnpm test"\n}',
        label: "Bash",
        callId: "tu-1",
      },
      {
        type: "activity",
        kind: "tool.failed",
        tone: "error",
        summary: "Bash failed",
        detail: "command not found: pnpm",
        label: "Bash",
        callId: "tu-1",
      },
    ])
  })

  it("carries a tool result's content-block body back as the detail", () => {
    const parser = createClaudeTurnParser()
    const events = push(parser, [
      assistantMessage([
        { type: "tool_use", id: "tu-9", name: "Read", input: { file_path: "a.ts" } },
      ]),
      line({
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tu-9",
              content: [
                { type: "text", text: "line one" },
                { type: "text", text: "line two" },
              ],
            },
          ],
        },
      }),
    ])
    const completed = events.find(
      (e) => e.type === "activity" && e.kind === "tool.completed"
    )
    expect(completed).toMatchObject({
      callId: "tu-9",
      label: "Read",
      detail: "line one\nline two",
    })
  })

  it("announces thinking once per assistant message", () => {
    const parser = createClaudeTurnParser()
    const thinkingStart = line({
      type: "stream_event",
      event: {
        type: "content_block_start",
        index: 0,
        content_block: { type: "thinking", thinking: "" },
      },
    })
    const events = push(parser, [thinkingStart, thinkingStart])
    expect(events.filter((e) => e.type === "activity")).toHaveLength(1)
  })

  it("takes the reasoning from the assistant block, which is where the CLI puts it", () => {
    // Recorded from `claude -p --output-format stream-json --verbose
    // --include-partial-messages`: a thinking block streams a signature_delta
    // and no text, and the complete block lands on the `assistant` line ahead
    // of its content_block_stop.
    const parser = createClaudeTurnParser()
    const events = push(parser, [
      line({
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "thinking", thinking: "" },
        },
      }),
      line({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "signature_delta", signature: "abc123" },
        },
      }),
      assistantMessage([
        { type: "thinking", thinking: "91 = 7 × 13", signature: "abc123" },
      ]),
      line({
        type: "stream_event",
        event: { type: "content_block_stop", index: 0 },
      }),
      textDelta("91 is not prime."),
    ])
    const activities = events.filter((e) => e.type === "activity")
    expect(activities).toMatchObject([
      { kind: "thinking", callId: "think-1" },
      { kind: "thinking.completed", callId: "think-1", detail: "91 = 7 × 13" },
    ])
    // Reasoning stays out of the reply, and the reply is unaffected.
    expect(parser.text()).toBe("91 is not prime.")
  })

  it("settles a thinking block with the reasoning text it streamed", () => {
    const parser = createClaudeTurnParser()
    const events = push(parser, [
      line({
        type: "stream_event",
        event: {
          type: "content_block_start",
          index: 0,
          content_block: { type: "thinking", thinking: "" },
        },
      }),
      line({
        type: "stream_event",
        event: {
          type: "content_block_delta",
          index: 0,
          delta: { type: "thinking_delta", thinking: "weigh the options" },
        },
      }),
      line({
        type: "stream_event",
        event: { type: "content_block_stop", index: 0 },
      }),
    ])
    const activities = events.filter((e) => e.type === "activity")
    // Start and stop share a callId so the timeline folds them into one step.
    expect(activities).toMatchObject([
      { kind: "thinking", callId: "think-1", detail: null },
      {
        kind: "thinking.completed",
        callId: "think-1",
        detail: "weigh the options",
      },
    ])
    // Reasoning never leaks into the assistant's reply.
    expect(parser.text()).toBe("")
  })

  it("settles with cost on a successful result", () => {
    const parser = createClaudeTurnParser()
    const events = push(parser, [textDelta("done"), result()])
    expect(events.at(-1)).toEqual({
      type: "result",
      state: "completed",
      errorMessage: null,
      totalCostUsd: 0.42,
    })
    expect(parser.settled()).toBe(true)
  })

  it("uses the result text when nothing streamed at all", () => {
    const parser = createClaudeTurnParser()
    push(parser, [result({ result: "final answer" })])
    expect(parser.text()).toBe("final answer")
  })

  it("turns a logged-out reply into an auth error, never a message", () => {
    // The CLI reports the login prompt as its *result text*, sometimes with
    // is_error=false — it must settle as a failed turn with the login hint.
    const parser = createClaudeTurnParser()
    const events = push(parser, [
      result({ is_error: false, result: "Not logged in · Please run /login" }),
    ])
    const settled = events.at(-1)
    expect(settled).toMatchObject({ type: "result", state: "error" })
    expect(settled?.type === "result" ? settled.errorMessage : "").toBe(
      CLAUDE_LOGIN_HINT
    )
    // The login prompt must not stand as the assistant's reply.
    expect(parser.text()).toBe("")
  })

  it("clears a streamed login prompt from the reply text", () => {
    const parser = createClaudeTurnParser()
    push(parser, [
      textDelta("Invalid API key · Please run /login"),
      result({ is_error: true, result: "Invalid API key · Please run /login" }),
    ])
    expect(parser.text()).toBe("")
  })

  it("maps an error result to an error state with its message", () => {
    const parser = createClaudeTurnParser()
    const events = push(parser, [
      result({ is_error: true, subtype: "error_max_turns", result: "boom" }),
    ])
    expect(events.at(-1)).toEqual({
      type: "result",
      state: "error",
      errorMessage: "boom",
      totalCostUsd: 0.42,
    })
  })

  it("ignores shell noise and unknown lines", () => {
    const parser = createClaudeTurnParser()
    expect(parser.push("not json at all")).toEqual([])
    expect(parser.push(line({ type: "mystery" }))).toEqual([])
    expect(parser.text()).toBe("")
  })
})
