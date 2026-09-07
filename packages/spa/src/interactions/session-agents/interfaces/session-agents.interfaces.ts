/**
 * `session-agents` feature — the agents an agent session can be handed to.
 *
 * An agent here is a command-line tool on this machine. Reviewer builds a shell
 * command from it, drops the prompt in, and reads back whatever the tool
 * prints — that is all `claude -p …` or `codex exec …` ever were. The built-in
 * ones are detected (the server asks each CLI what it can run); a custom one is
 * the same bargain written out by hand, so the two are described the same way.
 */
import type { AgentKind } from "@reviewer/core/threads";

/** Where the prompt is spliced into a custom agent's command. */
export const PROMPT_TOKEN = "{prompt}";

export interface CustomAgent {
  readonly id: string;
  readonly name: string;
  /** A shell command containing `{prompt}`, e.g. `my-agent run {prompt}`. */
  readonly command: string;
}

export interface AgentDraft {
  readonly name: string;
  readonly command: string;
}

/**
 * A row in the agent strip: a detected CLI or one you added. Detected agents
 * wear their vendor's mark; a custom one runs under the plain shell's.
 */
export interface SessionAgent {
  readonly id: string;
  readonly name: string;
  /** The command it runs, with the prompt left as a placeholder. */
  readonly command: string;
  readonly kind: AgentKind;
  readonly detected: boolean;
}
