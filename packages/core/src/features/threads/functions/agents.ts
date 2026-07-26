import type { AgentKind } from "../schema/threads.schema.ts"

export const AGENT_KINDS = [
  "terminal",
  "claude",
  "opencode",
  "codex",
  "cursor",
] as const satisfies ReadonlyArray<AgentKind>
const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`
export const agentLabel: Record<AgentKind, string> = {
  terminal: "Terminal",
  claude: "Claude Code",
  opencode: "opencode",
  codex: "Codex",
  cursor: "Cursor",
}
export const agentDefaultTitle = (agent: AgentKind): string =>
  agent === "terminal" ? "New thread" : agentLabel[agent]
export const agentCommand = (agent: AgentKind, input: string): string => {
  switch (agent) {
    case "terminal":
      return input
    case "claude":
      return `claude -p ${quote(input)} --output-format text`
    case "opencode":
      return `opencode run ${quote(input)}`
    case "codex":
      return `codex exec ${quote(input)}`
    case "cursor":
      return `cursor-agent -p ${quote(input)}`
  }
}

/**
 * Where a thread's native agent session id comes from — the same split
 * `chatSessionOrigin` draws for chats, applied to the agents run as a live TUI.
 * It decides whether a thread is resumable from its very first launch or only
 * after the agent has been talked to once.
 *
 *   none        the thread runs a plain shell and has no agent session to keep.
 *   minted      the id exists before the agent starts, so the thread can be
 *               resumed from the first launch (claude, cursor).
 *   discovered  the agent mints its own and doesn't say so, leaving the id to
 *               be read back from the session files it writes (codex,
 *               opencode) — until then the thread can't be resumed.
 *
 * How a minted id is obtained is the server's business and differs per agent:
 * claude takes any id we hand it, cursor has to be asked for one.
 */
export type AgentSessionOrigin = "none" | "minted" | "discovered"

export const agentSessionOrigin = (agent: AgentKind): AgentSessionOrigin => {
  switch (agent) {
    case "terminal":
      return "none"
    case "claude":
    case "cursor":
      return "minted"
    case "codex":
    case "opencode":
      return "discovered"
  }
}
