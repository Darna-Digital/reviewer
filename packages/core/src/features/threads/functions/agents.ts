import type { AgentKind } from "../schema/threads.schema.ts"

export const AGENT_KINDS = [
  "terminal",
  "claude",
  "opencode",
  "codex",
] as const satisfies ReadonlyArray<AgentKind>
const quote = (value: string) => `'${value.replace(/'/g, "'\\''")}'`
export const agentLabel: Record<AgentKind, string> = {
  terminal: "Terminal",
  claude: "Claude Code",
  opencode: "opencode",
  codex: "Codex",
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
  }
}
