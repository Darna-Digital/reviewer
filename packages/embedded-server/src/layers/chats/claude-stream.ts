/**
 * Claude Code stream-json → canonical chat events.
 *
 * `claude -p --output-format stream-json --verbose --include-partial-messages`
 * emits one JSON object per line. This module reduces that stream to the small
 * event vocabulary the chat feature understands (t3code-style): text deltas
 * for the assistant message, generic activities for tool calls / thinking,
 * a session id, and one terminal result. Pure and stateful-by-closure so it
 * can be unit-tested with recorded lines, no process involved.
 *
 * The relevant line shapes (fields we don't read are omitted):
 *   {type:"system", subtype:"init", session_id}
 *   {type:"stream_event", event:{type:"content_block_start"|"content_block_delta"|…}}
 *   {type:"assistant", message:{content:[{type:"text"|"tool_use"|"thinking",…}]}}
 *   {type:"user", message:{content:[{type:"tool_result", tool_use_id, is_error?}]}}
 *   {type:"result", subtype:"success"|…, is_error, result?, total_cost_usd?}
 */

// Shared canonical event/parser shapes live in turn-parser.ts (type-only
// import — the runtime import goes the other way, so no cycle).
import type { TurnEvent, TurnParser } from "./turn-parser.ts"

export type ClaudeStreamEvent = TurnEvent
export type ClaudeTurnParser = TurnParser

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const asString = (value: unknown): string | null =>
  typeof value === "string" ? value : null

/**
 * The CLI's logged-out / expired-credential replies. In `-p` mode Claude
 * can't open its /login flow, so an expired or revoked OAuth token surfaces
 * as reply text like "Not logged in · Please run /login" or "Invalid API
 * key · Please run /login" — which would otherwise land in the conversation
 * as if the assistant said it.
 */
const AUTH_ERROR_PATTERN =
  /not logged in|please run \/login|invalid api key|oauth token (has )?(expired|been revoked)|authentication[_ ]error/i

export const isClaudeAuthError = (text: string | null): boolean =>
  text !== null && AUTH_ERROR_PATTERN.test(text)

/**
 * What the chat shows instead of the CLI's bare logged-out reply. Rendered as
 * plain text with whitespace preserved (no markdown), so this is laid out with
 * real line breaks. In-depth on purpose: the durable fix has a shell-file
 * gotcha (login vs. interactive rc files) that bites people who put the export
 * in ~/.zshrc and see no change — because we launch the CLI through a login,
 * non-interactive shell (see providers.ts), which never sources ~/.zshrc.
 */
export const CLAUDE_LOGIN_HINT = [
  "Claude Code can't authenticate on this machine, so the turn was rejected.",
  "",
  "What happened: these chats run the `claude` CLI non-interactively (in `-p` " +
    "mode), so it can't open its own /login flow. When the credential it needs " +
    "is missing, expired, or revoked, it replies with a login prompt instead of " +
    "an answer — that's what this turn hit.",
  "",
  "Why: the OAuth token minted by an interactive `/login` eventually expires or " +
    "gets revoked, and there's no fallback credential for non-interactive runs " +
    "like this one.",
  "",
  "Fix (quick): open a terminal (or a Claude Code terminal thread), run " +
    "`claude`, then `/login`, and send your message again. This refreshes the " +
    "interactive token but will lapse again later.",
  "",
  "Fix (durable): create a long-lived token meant for non-interactive use —",
  "  1. Run `claude setup-token` once and copy the token it prints " +
    "(it only prints it; it is not stored for you).",
  "  2. Export it as CLAUDE_CODE_OAUTH_TOKEN from a shell startup file.",
  "",
  "Gotcha: put the export in a file your LOGIN shell reads, because we launch " +
    "the CLI through a login, non-interactive shell. On zsh that's ~/.zshenv " +
    "(or ~/.zprofile) — NOT ~/.zshrc, which is only read by interactive shells. " +
    "On bash use ~/.bash_profile or ~/.profile, not ~/.bashrc. Putting it in " +
    "~/.zshrc is the usual reason it works when you type `claude` yourself but " +
    "not here.",
  "",
  "Verify it's wired up: `zsh -lc 'echo ${CLAUDE_CODE_OAUTH_TOKEN:+present}'` " +
    "should print `present`. New turns pick it up automatically — no restart " +
    "needed, since each turn is a fresh login shell.",
].join("\n")

/**
 * A one-line human summary of a tool call. Common Claude tools carry their
 * most telling field (Bash command, file path); anything else shows its name.
 */
const toolSummary = (name: string, input: unknown): string => {
  if (isRecord(input)) {
    const command = asString(input["command"])
    if (command !== null) return `${name} — ${command.slice(0, 120)}`
    const path =
      asString(input["file_path"]) ??
      asString(input["path"]) ??
      asString(input["pattern"]) ??
      asString(input["url"]) ??
      asString(input["query"])
    if (path !== null) return `${name} — ${path.slice(0, 120)}`
  }
  return name
}

/** How much of a tool's input/output the timeline keeps. Enough to read a diff
 * or a command's output inline, still bounded so `chats.json` stays sane. */
const DETAIL_LIMIT = 4000

const truncate = (text: string): string =>
  text.length > DETAIL_LIMIT ? `${text.slice(0, DETAIL_LIMIT)}…` : text

const toolDetail = (input: unknown): string | null => {
  if (!isRecord(input) || Object.keys(input).length === 0) return null
  try {
    return truncate(JSON.stringify(input, null, 2))
  } catch {
    return null
  }
}

/**
 * A tool_result's body. The CLI sends either a bare string or Anthropic's
 * content-block array; both collapse to the text the user would want to read.
 */
const resultDetail = (content: unknown): string | null => {
  const text = asString(content)
  if (text !== null) return text.length === 0 ? null : truncate(text)
  if (!Array.isArray(content)) return null
  const parts = content.flatMap((block) => {
    if (!isRecord(block) || block["type"] !== "text") return []
    const value = asString(block["text"])
    return value === null || value.length === 0 ? [] : [value]
  })
  return parts.length === 0 ? null : truncate(parts.join("\n"))
}

export const createClaudeTurnParser = (): ClaudeTurnParser => {
  let buffer = ""
  let settled = false
  /** Characters streamed via deltas for the in-flight assistant message —
   * when a CLI doesn't emit partials, the complete message is used instead. */
  let deltaChars = 0
  /** Set after a complete assistant message so the next one (after a tool
   * round-trip) is separated from it in the single per-turn message. */
  let needSeparator = false
  /** tool_use id → name, to label the matching tool_result. */
  const toolNames = new Map<string, string>()
  /** The open thinking block, if any: announced at `content_block_start` so the
   * timeline shows it live, then settled at `content_block_stop` with the
   * reasoning text the deltas carried. Both events share a `callId`, so the
   * client folds them into one step exactly as it does a tool call. */
  let thinking: { callId: string; index: number | null; text: string } | null =
    null
  let thinkingSeq = 0
  /** Thinking already announced for the current assistant message. */
  let announcedThinking = false

  const settleThinking = (): ClaudeStreamEvent[] => {
    if (thinking === null) return []
    const { callId, text } = thinking
    thinking = null
    const reasoning = text.trim()
    return [
      {
        type: "activity",
        kind: "thinking.completed",
        tone: "info",
        summary: "Thought",
        detail: reasoning.length > 0 ? truncate(reasoning) : null,
        label: "Thinking",
        callId,
      },
    ]
  }

  const appendText = (text: string): ClaudeStreamEvent[] => {
    if (text.length === 0) return []
    const prefix = needSeparator && buffer.length > 0 ? "\n\n" : ""
    needSeparator = false
    buffer += prefix + text
    return [{ type: "delta", text: prefix + text }]
  }

  const onStreamEvent = (event: unknown): ClaudeStreamEvent[] => {
    if (!isRecord(event)) return []
    if (event["type"] === "content_block_start") {
      const block = event["content_block"]
      if (
        isRecord(block) &&
        block["type"] === "thinking" &&
        !announcedThinking
      ) {
        announcedThinking = true
        thinkingSeq += 1
        thinking = {
          callId: `think-${thinkingSeq}`,
          index: typeof event["index"] === "number" ? event["index"] : null,
          text: "",
        }
        return [
          {
            type: "activity",
            kind: "thinking",
            tone: "info",
            summary: "Thinking",
            detail: null,
            label: "Thinking",
            callId: thinking.callId,
          },
        ]
      }
      return []
    }
    if (event["type"] === "content_block_delta") {
      const delta = event["delta"]
      if (isRecord(delta) && delta["type"] === "text_delta") {
        const text = asString(delta["text"]) ?? ""
        deltaChars += text.length
        return appendText(text)
      }
      if (isRecord(delta) && delta["type"] === "thinking_delta") {
        if (thinking !== null) {
          thinking.text += asString(delta["thinking"]) ?? ""
        }
        return []
      }
      return []
    }
    if (event["type"] === "content_block_stop") {
      const closes =
        thinking !== null &&
        (thinking.index === null || thinking.index === event["index"])
      return closes ? settleThinking() : []
    }
    return []
  }

  const onAssistantMessage = (message: unknown): ClaudeStreamEvent[] => {
    // The complete thinking block arrives here, ahead of its
    // content_block_stop. Its `thinking` field is redacted like the deltas', so
    // in practice this finds nothing — it is read anyway so that a CLI which
    // stops redacting starts showing reasoning without a change here.
    if (
      thinking !== null &&
      isRecord(message) &&
      Array.isArray(message["content"])
    ) {
      for (const block of message["content"]) {
        if (!isRecord(block) || block["type"] !== "thinking") continue
        const reasoning = asString(block["thinking"])
        if (reasoning !== null && reasoning.length > 0) thinking.text = reasoning
      }
    }
    // A complete assistant message also closes a thinking block whose
    // content_block_stop never arrived (partials disabled, or a truncated run).
    const events: ClaudeStreamEvent[] = settleThinking()
    if (!isRecord(message) || !Array.isArray(message["content"])) return events
    for (const block of message["content"]) {
      if (!isRecord(block)) continue
      if (block["type"] === "tool_use") {
        const id = asString(block["id"]) ?? ""
        const name = asString(block["name"]) ?? "tool"
        if (id.length > 0) toolNames.set(id, name)
        events.push({
          type: "activity",
          kind: "tool.started",
          tone: "tool",
          summary: toolSummary(name, block["input"]),
          detail: toolDetail(block["input"]),
          label: name,
          ...(id.length > 0 ? { callId: id } : {}),
        })
      } else if (block["type"] === "text" && deltaChars === 0) {
        // No partials were streamed for this message (older CLI) — take the
        // complete text instead.
        events.push(...appendText(asString(block["text"]) ?? ""))
      }
    }
    // The next assistant message (after tool results) starts a new paragraph.
    needSeparator = true
    deltaChars = 0
    announcedThinking = false
    return events
  }

  const onUserMessage = (message: unknown): ClaudeStreamEvent[] => {
    if (!isRecord(message) || !Array.isArray(message["content"])) return []
    const events: ClaudeStreamEvent[] = []
    for (const block of message["content"]) {
      if (!isRecord(block) || block["type"] !== "tool_result") continue
      const callId = asString(block["tool_use_id"]) ?? ""
      const name = toolNames.get(callId) ?? "tool"
      const failed = block["is_error"] === true
      events.push({
        type: "activity",
        kind: failed ? "tool.failed" : "tool.completed",
        tone: failed ? "error" : "tool",
        summary: failed ? `${name} failed` : `${name} finished`,
        detail: resultDetail(block["content"]),
        label: name,
        ...(callId.length > 0 ? { callId } : {}),
      })
    }
    return events
  }

  const push = (line: string): ReadonlyArray<ClaudeStreamEvent> => {
    const trimmed = line.trim()
    if (trimmed.length === 0) return []
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      // Shell/rc noise on stdout — never let it corrupt the conversation.
      return []
    }
    if (!isRecord(parsed)) return []

    switch (parsed["type"]) {
      case "system": {
        const sessionId = asString(parsed["session_id"])
        return parsed["subtype"] === "init" && sessionId !== null
          ? [{ type: "session", sessionId }]
          : []
      }
      case "stream_event":
        return onStreamEvent(parsed["event"])
      case "assistant":
        return onAssistantMessage(parsed["message"])
      case "user":
        return onUserMessage(parsed["message"])
      case "result": {
        settled = true
        const resultText = asString(parsed["result"])
        // A logged-out CLI reports the login prompt as its reply (sometimes
        // even with is_error=false) — always a failed turn, never a message.
        const authFailed =
          isClaudeAuthError(resultText) || isClaudeAuthError(buffer)
        const failed = parsed["is_error"] === true || authFailed
        // Don't leave "Please run /login" standing as the assistant's reply —
        // the turn error (with the login hint) is the whole story.
        if (authFailed && isClaudeAuthError(buffer) && buffer.length < 200) {
          buffer = ""
        }
        // A successful result carries the final text — authoritative when
        // nothing streamed (e.g. partials disabled and no assistant line).
        if (!failed && buffer.length === 0 && resultText !== null) {
          buffer = resultText
        }
        return [
          {
            type: "result",
            state: failed ? "error" : "completed",
            errorMessage: failed
              ? authFailed
                ? CLAUDE_LOGIN_HINT
                : (resultText ?? asString(parsed["subtype"]) ?? "turn failed")
              : null,
            totalCostUsd:
              typeof parsed["total_cost_usd"] === "number"
                ? parsed["total_cost_usd"]
                : null,
          },
        ]
      }
      default:
        return []
    }
  }

  return { push, text: () => buffer, settled: () => settled }
}
