import { describe, expect, it } from "vitest";
import {
  createCursorTurnParser,
  CURSOR_LOGIN_HINT,
  isCursorAuthError,
} from "./cursor-stream.ts";

const line = (value: unknown) => JSON.stringify(value);

const assistant = (text: string) =>
  line({
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text }] },
  });

describe("createCursorTurnParser", () => {
  it("captures the session id from the init event", () => {
    const parser = createCursorTurnParser();
    expect(
      parser.push(
        line({
          type: "system",
          subtype: "init",
          session_id: "s-42",
          model: "composer-2.5",
        })
      )
    ).toEqual([{ type: "session", sessionId: "s-42" }]);
  });

  it("ignores non-init system events", () => {
    const parser = createCursorTurnParser();
    expect(
      parser.push(
        line({ type: "system", subtype: "rate_limit", session_id: "s" })
      )
    ).toEqual([]);
  });

  it("streams chunk-shaped partials as deltas", () => {
    const parser = createCursorTurnParser();
    expect(parser.push(assistant("Hello"))).toEqual([
      { type: "delta", text: "Hello" },
    ]);
    expect(parser.push(assistant(", world"))).toEqual([
      { type: "delta", text: ", world" },
    ]);
    expect(parser.text()).toBe("Hello, world");
  });

  it("streams cumulative partials as the tail only", () => {
    const parser = createCursorTurnParser();
    parser.push(assistant("Hello"));
    expect(parser.push(assistant("Hello, world"))).toEqual([
      { type: "delta", text: ", world" },
    ]);
    expect(parser.text()).toBe("Hello, world");
  });

  it("drops the complete message re-sent after its chunks", () => {
    const parser = createCursorTurnParser();
    parser.push(assistant("Hello"));
    parser.push(assistant(", world"));
    expect(parser.push(assistant("Hello, world"))).toEqual([]);
    expect(parser.text()).toBe("Hello, world");
  });

  it("reads a bare string message body", () => {
    const parser = createCursorTurnParser();
    parser.push(line({ type: "assistant", message: { content: "done" } }));
    expect(parser.text()).toBe("done");
  });

  it("labels a tool call from its nested *ToolCall key and pairs it by id", () => {
    const parser = createCursorTurnParser();
    const started = parser.push(
      line({
        type: "tool_call",
        subtype: "started",
        call_id: "c-1",
        tool_call: { shellToolCall: { args: { command: "pnpm test" } } },
      })
    );
    expect(started).toEqual([
      {
        type: "activity",
        kind: "tool.started",
        tone: "tool",
        summary: "Shell — pnpm test",
        detail: JSON.stringify({ command: "pnpm test" }, null, 2),
        label: "Shell",
        callId: "c-1",
      },
    ]);
    // The completion doesn't repeat the payload — the label comes from the id.
    const completed = parser.push(
      line({ type: "tool_call", subtype: "completed", call_id: "c-1" })
    );
    expect(completed[0]).toMatchObject({
      kind: "tool.completed",
      tone: "tool",
      summary: "Shell finished",
      label: "Shell",
      callId: "c-1",
    });
  });

  it("summarises a path-shaped tool and reports an unsuccessful result", () => {
    const parser = createCursorTurnParser();
    expect(
      parser.push(
        line({
          type: "tool_call",
          subtype: "started",
          call_id: "c-2",
          tool_call: { readToolCall: { args: { path: "src/app.ts" } } },
        })
      )[0]
    ).toMatchObject({ summary: "Read — src/app.ts", label: "Read" });
    expect(
      parser.push(
        line({
          type: "tool_call",
          subtype: "completed",
          call_id: "c-2",
          tool_call: { readToolCall: { result: { success: false } } },
        })
      )[0]
    ).toMatchObject({
      kind: "tool.failed",
      tone: "error",
      summary: "Read failed",
    });
  });

  it("separates the assistant messages either side of a tool call", () => {
    const parser = createCursorTurnParser();
    parser.push(assistant("Looking."));
    parser.push(
      line({
        type: "tool_call",
        subtype: "started",
        call_id: "c-3",
        tool_call: { readToolCall: { args: { path: "a.ts" } } },
      })
    );
    parser.push(assistant("Found it."));
    expect(parser.text()).toBe("Looking.\n\nFound it.");
  });

  it("settles a successful turn and keeps its cost", () => {
    const parser = createCursorTurnParser();
    parser.push(assistant("done"));
    expect(
      parser.push(
        line({
          type: "result",
          subtype: "success",
          is_error: false,
          duration_ms: 1200,
          total_cost_usd: 0.02,
        })
      )
    ).toEqual([
      {
        type: "result",
        state: "completed",
        errorMessage: null,
        totalCostUsd: 0.02,
      },
    ]);
    expect(parser.settled()).toBe(true);
  });

  it("takes the result text when nothing streamed", () => {
    const parser = createCursorTurnParser();
    parser.push(
      line({
        type: "result",
        subtype: "success",
        is_error: false,
        result: "42",
      })
    );
    expect(parser.text()).toBe("42");
  });

  it("turns a logged-out reply into a failed turn with the login hint", () => {
    const parser = createCursorTurnParser();
    parser.push(assistant("Not logged in. Please run cursor-agent login."));
    const events = parser.push(
      line({ type: "result", subtype: "success", is_error: false })
    );
    expect(events).toEqual([
      {
        type: "result",
        state: "error",
        errorMessage: CURSOR_LOGIN_HINT,
        totalCostUsd: null,
      },
    ]);
    // The login prompt must not stand as the assistant's reply.
    expect(parser.text()).toBe("");
  });

  it("reports an errored result with the CLI's own message", () => {
    const parser = createCursorTurnParser();
    expect(
      parser.push(
        line({
          type: "result",
          subtype: "error",
          is_error: true,
          result: "boom",
        })
      )[0]
    ).toMatchObject({ state: "error", errorMessage: "boom" });
  });

  it("ignores blank lines and non-JSON shell noise", () => {
    const parser = createCursorTurnParser();
    expect(parser.push("")).toEqual([]);
    expect(parser.push("zsh: command not found: nope")).toEqual([]);
    expect(parser.push(line(["not", "an", "object"]))).toEqual([]);
    expect(parser.text()).toBe("");
  });
});

describe("isCursorAuthError", () => {
  it("matches the logged-out phrasings and nothing else", () => {
    expect(isCursorAuthError("Not logged in")).toBe(true);
    expect(isCursorAuthError("please run cursor-agent login")).toBe(true);
    expect(isCursorAuthError("Unauthorized")).toBe(true);
    expect(isCursorAuthError("could not read file")).toBe(false);
    expect(isCursorAuthError(null)).toBe(false);
  });
});
