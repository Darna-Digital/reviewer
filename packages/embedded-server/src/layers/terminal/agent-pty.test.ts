import { describe, expect, it } from "vitest"
import { agentPtyProgram, agentSessionArgs } from "./agent-pty.ts"

describe("agentSessionArgs", () => {
  it("launches fresh when the thread has no session id yet", () => {
    for (const agent of ["claude", "codex", "opencode", "cursor"] as const) {
      expect(agentSessionArgs(agent, { sessionId: null, resume: false })).toBe(
        ""
      )
    }
  })

  it("claude presets its id, then resumes it", () => {
    expect(agentSessionArgs("claude", { sessionId: "s1", resume: false })).toBe(
      "--session-id s1"
    )
    expect(agentSessionArgs("claude", { sessionId: "s1", resume: true })).toBe(
      "--resume s1"
    )
  })

  it("cursor resumes the chat minted for it on both launches", () => {
    // The chat is created before the TUI starts, so the first launch resumes an
    // empty chat — there is no "start a new one with this id" form to use.
    expect(agentSessionArgs("cursor", { sessionId: "c1", resume: false })).toBe(
      "--resume c1"
    )
    expect(agentSessionArgs("cursor", { sessionId: "c1", resume: true })).toBe(
      "--resume c1"
    )
  })

  it("codex/opencode can only resume an id they already minted", () => {
    expect(agentSessionArgs("codex", { sessionId: "t1", resume: false })).toBe(
      ""
    )
    expect(agentSessionArgs("codex", { sessionId: "t1", resume: true })).toBe(
      "resume t1"
    )
    expect(
      agentSessionArgs("opencode", { sessionId: "ses_1", resume: false })
    ).toBe("")
    expect(
      agentSessionArgs("opencode", { sessionId: "ses_1", resume: true })
    ).toBe("--session ses_1")
  })

  it("a plain terminal never carries session args", () => {
    expect(agentSessionArgs("terminal", { sessionId: "x", resume: true })).toBe(
      ""
    )
  })
})

describe("agentPtyProgram", () => {
  const command = (p: { args: ReadonlyArray<string> }) => p.args.at(-1) ?? ""

  it("runs cursor's TUI through the login shell with its session args", () => {
    const program = agentPtyProgram("cursor", "--resume c1")
    expect(program.args.slice(0, 3)).toEqual(["-l", "-i", "-c"])
    expect(command(program)).toContain("exec cursor-agent --resume c1")
    // A missing CLI is reported, not left as a bare "command not found".
    expect(command(program)).toContain("could not start cursor-agent")
  })

  it("gives a plain terminal the interactive login shell itself", () => {
    expect(agentPtyProgram("terminal").args).toEqual(["-l", "-i"])
  })
})
