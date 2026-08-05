/**
 * Cursor Agent stream-json → canonical chat events.
 *
 * `cursor-agent -p --output-format stream-json --stream-partial-output` emits
 * one JSON object per line, in an envelope close to Claude Code's but with its
 * own tool vocabulary. The shapes we read (other fields omitted):
 *
 *   {type:"system", subtype:"init", session_id, model, cwd}
 *   {type:"assistant", message:{role:"assistant", content:[{type:"text",text}]}}
 *   {type:"tool_call", subtype:"started"|"completed",
 *    call_id, tool_call:{<name>ToolCall:{args:{…}, result:{…}}}}
 *   {type:"result", subtype:"success"|…, is_error, result?, duration_ms?,
 *    total_cost_usd?}
 *
 * Two things make this more than a rename of the claude parser:
 *
 * 1. Partial assistant events have no documented delta/complete marker, and
 *    across CLI versions the same run mixes chunk-shaped and whole-message
 *    shaped events. Emitting both would print the reply twice, so text is
 *    reconciled against what's already buffered (see `appendAssistantText`).
 * 2. The tool payload is explicitly unstable — the *name* of the nested
 *    `*ToolCall` key is the tool, and its `args`/`result` are free-form — so
 *    the envelope is trusted and the payload is only mined for a summary.
 */
import type { TurnEvent, TurnParser } from "./turn-parser.ts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/** How much of a tool's payload the timeline keeps — matches claude-stream. */
const DETAIL_LIMIT = 4000;

const truncate = (text: string): string =>
  text.length > DETAIL_LIMIT ? `${text.slice(0, DETAIL_LIMIT)}…` : text;

/**
 * Cursor's logged-out replies. `-p` can't open the browser login flow, so a
 * missing or expired credential comes back as text ("Not logged in", "run
 * cursor-agent login") that would otherwise read as the assistant's answer.
 */
const AUTH_ERROR_PATTERN =
  /not logged in|cursor-agent login|unauthori[sz]ed|invalid api key|authentication[_ ]error/i;

export const isCursorAuthError = (text: string | null): boolean =>
  text !== null && AUTH_ERROR_PATTERN.test(text);

/** Shown instead of the CLI's bare logged-out reply. Mirrors the Claude hint's
 * shell-file gotcha, because turns are launched the same way: a login,
 * non-interactive shell that never sources ~/.zshrc. */
export const CURSOR_LOGIN_HINT = [
  "Cursor Agent can't authenticate on this machine, so the turn was rejected.",
  "",
  "What happened: these chats run the `cursor-agent` CLI non-interactively " +
    "(in `-p` mode), so it can't open its own browser login. With no usable " +
    "credential it answers with a login prompt instead of a reply — that's " +
    "what this turn hit.",
  "",
  "Fix (quick): open a terminal (or a Cursor terminal thread), run " +
    "`cursor-agent login`, and send your message again.",
  "",
  "Fix (durable, and what CI uses): create an API key in Cursor's dashboard " +
    "and export it as CURSOR_API_KEY from a shell startup file.",
  "",
  "Gotcha: put the export in a file your LOGIN shell reads — we launch the " +
    "CLI through a login, non-interactive shell. On zsh that's ~/.zshenv (or " +
    "~/.zprofile), NOT ~/.zshrc. On bash use ~/.bash_profile or ~/.profile, " +
    "not ~/.bashrc.",
  "",
  "Verify it's wired up: `zsh -lc 'echo ${CURSOR_API_KEY:+present}'` should " +
    "print `present`. New turns pick it up automatically — each one is a " +
    "fresh login shell.",
].join("\n");

/**
 * The tool behind a `tool_call` event. Cursor nests one `<name>ToolCall` key
 * (`readToolCall`, `shellToolCall`, …) whose contents are the tool's own
 * shape; the key name is the only part worth relying on.
 */
const toolCallEntry = (
  toolCall: unknown
): { name: string; payload: Record<string, unknown> } | null => {
  if (!isRecord(toolCall)) return null;
  for (const [key, value] of Object.entries(toolCall)) {
    if (!key.endsWith("ToolCall")) continue;
    return {
      name: key.slice(0, -"ToolCall".length),
      payload: isRecord(value) ? value : {},
    };
  }
  return null;
};

/** Title-cased tool label ("read" → "Read"), so cursor's activities read like
 * every other provider's in the work log. */
const toolLabel = (name: string): string =>
  name.length === 0 ? "Tool" : name.slice(0, 1).toUpperCase() + name.slice(1);

/**
 * A one-line summary from whichever telling field the tool happens to carry.
 * Unknown tools fall back to their name alone rather than guessing.
 */
const toolSummary = (label: string, args: unknown): string => {
  if (isRecord(args)) {
    const command = asString(args["command"]);
    if (command !== null) return `${label} — ${command.slice(0, 120)}`;
    const subject =
      asString(args["path"]) ??
      asString(args["file_path"]) ??
      asString(args["pattern"]) ??
      asString(args["query"]) ??
      asString(args["url"]);
    if (subject !== null) return `${label} — ${subject.slice(0, 120)}`;
  }
  return label;
};

const payloadDetail = (value: unknown): string | null => {
  if (!isRecord(value) || Object.keys(value).length === 0) return null;
  try {
    return truncate(JSON.stringify(value, null, 2));
  } catch {
    return null;
  }
};

/** The plain text of an assistant message: a bare string, or Anthropic-style
 * content blocks, both of which cursor has emitted. */
const messageText = (message: unknown): string => {
  if (!isRecord(message)) return "";
  const direct = asString(message["content"]);
  if (direct !== null) return direct;
  const content = message["content"];
  if (!Array.isArray(content)) return "";
  return content
    .flatMap((block) => {
      if (!isRecord(block) || block["type"] !== "text") return [];
      const text = asString(block["text"]);
      return text === null ? [] : [text];
    })
    .join("");
};

export const createCursorTurnParser = (): TurnParser => {
  let buffer = "";
  let settled = false;
  /** Text of the assistant message currently being streamed, so a chunk can be
   * told apart from a re-send of the whole message. Reset by a tool round-trip,
   * which starts a new message. */
  let currentMessage = "";
  /** Set after a tool round-trip so the next assistant message is separated
   * from the previous one inside the single per-turn message. */
  let needSeparator = false;
  /** call_id → label, so a `completed` event can name the tool its `started`
   * announced (the completion doesn't always repeat the payload). */
  const toolLabels = new Map<string, string>();

  const emit = (text: string): TurnEvent[] => {
    if (text.length === 0) return [];
    buffer += text;
    return [{ type: "delta", text }];
  };

  /**
   * Fold one assistant event into the reply. With `--stream-partial-output`
   * cursor sends the message in pieces, but a piece is sometimes the new chunk
   * and sometimes the whole message so far — and the finished message is often
   * re-sent complete on top of either. Anchoring on the text already held makes
   * all three idempotent: an event that restates what we have contributes only
   * the tail past it (nothing at all when it restates it exactly), and anything
   * else is a fresh chunk and is appended.
   */
  const appendAssistantText = (text: string): TurnEvent[] => {
    if (text.length === 0) return [];
    if (needSeparator || currentMessage.length === 0) {
      const separator = needSeparator && buffer.length > 0 ? "\n\n" : "";
      needSeparator = false;
      currentMessage = text;
      return emit(separator + text);
    }
    if (text.startsWith(currentMessage)) {
      const tail = text.slice(currentMessage.length);
      currentMessage = text;
      return emit(tail);
    }
    currentMessage += text;
    return emit(text);
  };

  const onToolCall = (parsed: Record<string, unknown>): TurnEvent[] => {
    const callId = asString(parsed["call_id"]) ?? "";
    const entry = toolCallEntry(parsed["tool_call"]);
    const started = parsed["subtype"] === "started";
    const label =
      entry !== null
        ? toolLabel(entry.name)
        : (toolLabels.get(callId) ?? asString(parsed["name"]) ?? "Tool");
    if (started && callId.length > 0) toolLabels.set(callId, label);
    // A tool round-trip ends the assistant message it interrupted.
    if (started) {
      currentMessage = "";
      needSeparator = buffer.length > 0;
    }
    const args = entry?.payload["args"];
    const result = entry?.payload["result"];
    const failed =
      parsed["subtype"] === "error" ||
      parsed["is_error"] === true ||
      (isRecord(result) && result["success"] === false);
    return [
      {
        type: "activity",
        kind: started
          ? "tool.started"
          : failed
            ? "tool.failed"
            : "tool.completed",
        tone: failed ? "error" : "tool",
        summary: started
          ? toolSummary(label, args)
          : failed
            ? `${label} failed`
            : `${label} finished`,
        detail: payloadDetail(started ? args : result),
        label,
        ...(callId.length > 0 ? { callId } : {}),
      },
    ];
  };

  const push = (line: string): ReadonlyArray<TurnEvent> => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Shell/rc noise on stdout — never let it corrupt the conversation.
      return [];
    }
    if (!isRecord(parsed)) return [];

    switch (parsed["type"]) {
      case "system": {
        const sessionId = asString(parsed["session_id"]);
        return parsed["subtype"] === "init" && sessionId !== null
          ? [{ type: "session", sessionId }]
          : [];
      }
      case "assistant":
        return appendAssistantText(messageText(parsed["message"]));
      case "tool_call":
        return onToolCall(parsed);
      case "result": {
        settled = true;
        const resultText = asString(parsed["result"]);
        // A logged-out CLI reports the login prompt as its reply, sometimes
        // with is_error=false — always a failed turn, never a message.
        const authFailed =
          isCursorAuthError(resultText) || isCursorAuthError(buffer);
        const failed =
          parsed["is_error"] === true ||
          parsed["subtype"] === "error" ||
          authFailed;
        // Don't leave "run cursor-agent login" standing as the assistant's
        // reply — the turn error carries the whole story.
        if (authFailed && isCursorAuthError(buffer) && buffer.length < 200) {
          buffer = "";
        }
        // A successful result carries the final text — authoritative when
        // nothing streamed (partials unsupported, or an assistant-less run).
        if (!failed && buffer.length === 0 && resultText !== null) {
          buffer = resultText;
        }
        return [
          {
            type: "result",
            state: failed ? "error" : "completed",
            errorMessage: failed
              ? authFailed
                ? CURSOR_LOGIN_HINT
                : (resultText ?? asString(parsed["subtype"]) ?? "turn failed")
              : null,
            totalCostUsd:
              typeof parsed["total_cost_usd"] === "number"
                ? parsed["total_cost_usd"]
                : null,
          },
        ];
      }
      default:
        return [];
    }
  };

  return { push, text: () => buffer, settled: () => settled };
};
