/**
 * The provider-agnostic turn parser contract: each provider reduces its CLI's
 * stdout to the same canonical events (t3code's vocabulary, sized down) —
 * text deltas, generic activities, a native session id, one terminal result.
 * The chat runtime is provider-blind past this seam.
 */
import type { ChatProviderKind } from "@byconvo/core/chats";
import {
  CLAUDE_LOGIN_HINT,
  createClaudeTurnParser,
  isClaudeAuthError,
} from "./claude-stream.ts";
import { createCodexTurnParser } from "./codex-stream.ts";
import {
  createCursorTurnParser,
  CURSOR_LOGIN_HINT,
  isCursorAuthError,
} from "./cursor-stream.ts";
import { createOpencodeTurnParser } from "./opencode-stream.ts";

export type TurnEvent =
  | { readonly type: "session"; readonly sessionId: string }
  | { readonly type: "delta"; readonly text: string }
  | {
      readonly type: "activity";
      readonly kind: string;
      readonly tone: "info" | "tool" | "error";
      readonly summary: string;
      readonly detail: string | null;
      /** Provider tool-call id, so the completion can be matched to its start. */
      readonly callId?: string;
      /** The bare tool name, when the activity is a tool call. */
      readonly label?: string;
    }
  | {
      readonly type: "result";
      readonly state: "completed" | "error";
      readonly errorMessage: string | null;
      readonly totalCostUsd: number | null;
    };

export interface TurnParser {
  /** Feed one stdout line; returns the canonical events it produced. */
  readonly push: (line: string) => ReadonlyArray<TurnEvent>;
  /** The assistant text assembled so far (all deltas concatenated). */
  readonly text: () => string;
  /** Whether a terminal `result` line has been seen. */
  readonly settled: () => boolean;
}

export const createTurnParser = (provider: ChatProviderKind): TurnParser => {
  switch (provider) {
    case "claude":
      return createClaudeTurnParser();
    case "codex":
      return createCodexTurnParser();
    case "opencode":
      return createOpencodeTurnParser();
    case "cursor":
      return createCursorTurnParser();
  }
};

/**
 * The actionable hint for a turn that died because its CLI isn't logged in, or
 * null when the failure was anything else. The parsers already catch this when
 * the CLI reports it in-stream, but a logged-out CLI can also die with the
 * prompt on stderr and no result line at all, so the runtime runs whatever
 * error it ended up with through here and gets the same message either way.
 */
export const loginHint = (
  provider: ChatProviderKind,
  error: string
): string | null => {
  switch (provider) {
    case "claude":
      return isClaudeAuthError(error) ? CLAUDE_LOGIN_HINT : null;
    case "cursor":
      return isCursorAuthError(error) ? CURSOR_LOGIN_HINT : null;
    // codex and opencode fail loudly enough on their own.
    case "codex":
    case "opencode":
      return null;
  }
};
