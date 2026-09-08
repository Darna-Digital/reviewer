import { describe, expect, it } from "vitest";
import {
  AGENT_KINDS,
  agentCommand,
  agentSessionOrigin,
  type AgentSessionOrigin,
} from "./agents.ts";

describe("agentSessionOrigin", () => {
  const expected: Record<(typeof AGENT_KINDS)[number], AgentSessionOrigin> = {
    terminal: "none",
    claude: "minted",
    cursor: "minted",
    codex: "discovered",
    opencode: "discovered",
  };

  it("classifies every agent", () => {
    for (const agent of AGENT_KINDS) {
      expect(agentSessionOrigin(agent)).toBe(expected[agent]);
    }
  });

  it("only the plain terminal has no session to keep", () => {
    const none = AGENT_KINDS.filter((a) => agentSessionOrigin(a) === "none");
    expect(none).toEqual(["terminal"]);
  });
});

describe("agentCommand", () => {
  it("wraps the prompt for each agent and passes a terminal's through", () => {
    expect(agentCommand("terminal", "ls -la")).toBe("ls -la");
    expect(agentCommand("claude", "hi")).toBe(
      "claude -p 'hi' --output-format text"
    );
    expect(agentCommand("opencode", "hi")).toBe("opencode run 'hi'");
    expect(agentCommand("codex", "hi")).toBe("codex exec 'hi'");
    expect(agentCommand("cursor", "hi")).toBe("cursor-agent -p 'hi'");
  });

  it("escapes quotes in the prompt so they can't break out of the command", () => {
    expect(agentCommand("cursor", "it's fine")).toBe(
      "cursor-agent -p 'it'\\''s fine'"
    );
  });

  it("drops NUL bytes, which a spawn's argv cannot carry", () => {
    expect(agentCommand("claude", "diff\u0000 tail")).toBe(
      "claude -p 'diff tail' --output-format text"
    );
    expect(agentCommand("terminal", "ls\u0000 -la")).toBe("ls -la");
  });
});
