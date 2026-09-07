/**
 * Chat provider presets — how a chat turn becomes a local agent CLI
 * invocation. Mirrors `features/threads/agents.ts` (the CLI is borrowed from
 * the developer's own install, launched through their login shell for a real
 * PATH), but in each agent's *streaming/captured* one-turn mode instead of a
 * PTY, so the server can parse the conversation instead of proxying raw bytes.
 *
 *   claude   `claude -p --output-format stream-json` — full token streaming
 *   codex    `codex exec --json` — JSONL item/turn events
 *   opencode `opencode run` — plain text streamed as it prints
 *   cursor   `cursor-agent -p --output-format stream-json` — token streaming
 *
 * Effort and access are not one row of switches copied four times: each agent
 * gets the flags it actually has, at the levels its own CLI reported (see
 * `chats.capabilities.ts`), and nothing is sent for a dimension an agent has no
 * say over.
 */
import { resolveChatAccess } from "@reviewer/core/chats";
import type { Chat, ChatMessage } from "@reviewer/core/chats";

export interface ChatTurnProgram {
  readonly file: string;
  readonly args: ReadonlyArray<string>;
  /** Extra environment merged over the inherited process env. */
  readonly env: Record<string, string>;
  /** Written to the CLI's stdin (the prompt), which is then closed. */
  readonly stdin: string;
}

/** The chat's native session, decided by the runtime from the provider's
 * `chatSessionOrigin`: a minted id is ours up-front; every other agent mints
 * its own (id stays null until captured), so only a known id can be resumed. */
export interface ChatTurnSession {
  readonly id: string | null;
  readonly resume: boolean;
}

/** The user's shell — the CLI is launched through it (see threads/agents.ts:
 * a bare spawn under a GUI launch misses the developer's real PATH). */
const userShell = (): string => process.env["SHELL"] ?? "bash";

/**
 * Claude's reasoning budget per effort level, via the documented
 * MAX_THINKING_TOKENS setting env. An approximation of a first-class effort
 * option: enough thinking to matter at "high" without runaway turns at "low".
 *
 * These three are also the levels claude is offered at (`chatCapabilities`); a
 * level from anywhere else buys no budget rather than a guessed one, and the
 * turn runs on claude's own default.
 */
const CLAUDE_THINKING_TOKENS: Readonly<Record<string, string>> = {
  low: "1024",
  medium: "8192",
  high: "31999",
};

const claudeEnv = (chat: Chat): Record<string, string> => {
  const tokens = CLAUDE_THINKING_TOKENS[chat.effort];
  return tokens === undefined ? {} : { MAX_THINKING_TOKENS: tokens };
};

/**
 * `--permission-mode` / skip-permissions flags for the chat's access level.
 * Non-interactive runs can't pause for approval, so "supervised" leaves the
 * default mode where gated tools are refused (surfaced as failed activities).
 */
const claudePermissionArgs = (chat: Chat): ReadonlyArray<string> => {
  switch (chat.access) {
    case "supervised":
      return [];
    case "acceptEdits":
      return ["--permission-mode", "acceptEdits"];
    case "fullAccess":
      return ["--dangerously-skip-permissions"];
  }
};

/** Codex sandbox/approval flags. */
const codexAccessArgs = (chat: Chat): ReadonlyArray<string> => {
  switch (chat.access) {
    case "supervised":
      return [];
    case "acceptEdits":
      return ["--full-auto"];
    case "fullAccess":
      return ["--dangerously-bypass-approvals-and-sandbox"];
  }
};

/**
 * Cursor's one permission switch: `--force` lets the agent edit files and run
 * commands without asking. Print mode can't ask, so without it a turn stalls on
 * the first write. There is no sandbox tier between "ask" and "don't ask" —
 * which tier a chat's access lands on for an agent that coarse is decided once,
 * in `resolveChatAccess`, so the menu and the flag cannot disagree.
 */
const cursorAccessArgs = (chat: Chat): ReadonlyArray<string> =>
  resolveChatAccess("cursor", chat.access) === "fullAccess" ? ["--force"] : [];

/**
 * opencode's one permission switch: `--auto` approves everything the
 * developer's own opencode config does not explicitly deny. Without it that
 * config decides alone, which is what supervised means for this agent.
 */
const opencodeAccessArgs = (chat: Chat): ReadonlyArray<string> =>
  resolveChatAccess("opencode", chat.access) === "fullAccess" ? ["--auto"] : [];

/** Single-quote a string for safe interpolation into a shell command. */
const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`;

const inLoginShell = (
  cli: string,
  parts: ReadonlyArray<string>
): Pick<ChatTurnProgram, "file" | "args"> => ({
  file: userShell(),
  // Login (not interactive) shell: real PATH without rc files that expect a
  // TTY writing noise into the captured stdout.
  args: [
    "-l",
    "-c",
    `command -v ${cli} >/dev/null 2>&1 && exec ${parts.map(quote).join(" ")} || { echo "could not start ${cli} — is it installed and on your PATH?" >&2; exit 127; }`,
  ],
});

/**
 * A turn's prompt, with the prior conversation prepended when the agent has no
 * native session to resume — the case right after the chat's agent is switched
 * (a fresh CLI knows nothing of what came before). Within one provider the CLI
 * resumes its own session and carries the history itself, so this is a no-op
 * (empty history → the prompt unchanged). Streaming/blank messages are skipped.
 */
export const withHistory = (
  messages: ReadonlyArray<ChatMessage>,
  prompt: string
): string => {
  const prior = messages.filter((m) => m.text.trim().length > 0);
  if (prior.length === 0) return prompt;
  const transcript = prior
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
    .join("\n\n");
  return [
    "You are continuing an existing conversation. For context, here is the",
    "transcript so far (it may have been produced by a different agent):",
    "",
    "<conversation_history>",
    transcript,
    "</conversation_history>",
    "",
    "Reply to this latest message, using the history above for context:",
    "",
    prompt,
  ].join("\n");
};

/**
 * Append attached image paths to the prompt so the agent reads them — the same
 * mechanism the terminal threads use (a dropped image becomes a temp-file path
 * handed to the CLI). Every supported CLI reads a local image referenced by its
 * absolute path. No images → the prompt is returned unchanged; an image-only
 * message (blank prompt) becomes just the reference lines.
 */
export const withAttachedImages = (
  prompt: string,
  imagePaths: ReadonlyArray<string>
): string => {
  if (imagePaths.length === 0) return prompt;
  const refs = imagePaths.map((path) => `[Attached image: ${path}]`).join("\n");
  return prompt.trim().length > 0 ? `${prompt}\n\n${refs}` : refs;
};

/**
 * Build the streaming one-turn invocation for `chat`. The prompt goes through
 * stdin (never argv, so its size and content can't break the command line);
 * stdout is parsed by the chat runtime with the provider's parser.
 *
 * Session continuity works like the PTY threads (threads/agents.ts), along the
 * split `chatSessionOrigin` draws: claude lets us mint the id, so a fresh chat
 * passes `--session-id` (the runtime persists it once the CLI confirms it) and
 * later turns `--resume`; the others mint their own, which the runtime captures
 * from the event stream (cursor, codex) or the CLI's session files (opencode).
 */
export const chatTurnProgram = (
  chat: Chat,
  prompt: string,
  session: ChatTurnSession
): ChatTurnProgram => {
  switch (chat.provider) {
    case "claude": {
      const parts = [
        "claude",
        "-p",
        "--output-format",
        "stream-json",
        "--verbose",
        "--include-partial-messages",
        ...(chat.model.length > 0 ? ["--model", chat.model] : []),
        ...claudePermissionArgs(chat),
        ...(session.id !== null
          ? session.resume
            ? ["--resume", session.id]
            : ["--session-id", session.id]
          : []),
      ];
      return {
        ...inLoginShell("claude", parts),
        env: claudeEnv(chat),
        stdin: prompt,
      };
    }
    case "codex": {
      const parts = [
        "codex",
        "exec",
        ...(session.resume && session.id !== null
          ? ["resume", session.id]
          : []),
        "--json",
        // Only levels the model itself reported (`supported_reasoning_levels`)
        // are ever offered, and none at all when codex never answered — in
        // which case the model reasons at its own default.
        ...(chat.effort.length > 0
          ? ["-c", `model_reasoning_effort="${chat.effort}"`]
          : []),
        ...(chat.model.length > 0 ? ["--model", chat.model] : []),
        ...codexAccessArgs(chat),
        // "-" = read the prompt from stdin.
        "-",
      ];
      return { ...inLoginShell("codex", parts), env: {}, stdin: prompt };
    }
    case "opencode": {
      const parts = [
        "opencode",
        "run",
        ...(chat.model.length > 0 ? ["--model", chat.model] : []),
        // opencode names its reasoning levels per model, as variants, and only
        // those are offered — a model that named none is run as it comes.
        ...(chat.effort.length > 0 ? ["--variant", chat.effort] : []),
        ...opencodeAccessArgs(chat),
        ...(session.resume && session.id !== null
          ? ["--session", session.id]
          : []),
      ];
      return { ...inLoginShell("opencode", parts), env: {}, stdin: prompt };
    }
    case "cursor": {
      const parts = [
        "cursor-agent",
        "-p",
        "--output-format",
        "stream-json",
        // Without this the stream only carries whole messages; with it the
        // reply arrives in chunks, like claude's partial messages.
        "--stream-partial-output",
        ...(chat.model.length > 0 ? ["--model", chat.model] : []),
        // No effort flag — cursor picks reasoning depth per model itself.
        ...cursorAccessArgs(chat),
        ...(session.resume && session.id !== null
          ? ["--resume", session.id]
          : []),
      ];
      return { ...inLoginShell("cursor-agent", parts), env: {}, stdin: prompt };
    }
  }
};
