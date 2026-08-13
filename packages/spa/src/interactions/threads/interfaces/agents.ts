/**
 * Agent presets — the labels and marks every agent-picking surface draws from
 * (chats, tasks, review assignment, and the mark an older terminal session
 * created against an agent still carries). Mirrors the server's agent set; the
 * server owns how each agent's input is turned into a command.
 */
import type { AgentKind } from "@byconvo/core/threads";

export const AGENTS: ReadonlyArray<{
  kind: AgentKind;
  label: string;
  /** The vendor's name alone, for possessive forms like "Nadia's Codex". */
  short: string;
  hint: string;
}> = [
  {
    kind: "terminal",
    label: "Terminal",
    short: "Terminal",
    hint: "Run shell commands",
  },
  { kind: "claude", label: "Claude Code", short: "Claude", hint: "claude -p" },
  {
    kind: "opencode",
    label: "opencode",
    short: "opencode",
    hint: "opencode run",
  },
  { kind: "codex", label: "Codex", short: "Codex", hint: "codex exec" },
  { kind: "cursor", label: "Cursor", short: "Cursor", hint: "cursor-agent" },
];

export const agentLabel = (agent: AgentKind): string =>
  AGENTS.find((a) => a.kind === agent)?.label ?? agent;

export const agentShort = (agent: AgentKind): string =>
  AGENTS.find((a) => a.kind === agent)?.short ?? agent;

/** The command the agent runs behind the label, e.g. `claude -p`. */
export const agentHint = (agent: AgentKind): string =>
  AGENTS.find((a) => a.kind === agent)?.hint ?? "";

/** A terminal thread runs raw shell; agent threads send prompts to a CLI. */
export const isAgentThread = (agent: AgentKind): boolean =>
  agent !== "terminal";
