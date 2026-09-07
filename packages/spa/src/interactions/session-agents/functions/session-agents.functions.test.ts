import { describe, expect, it } from "vitest";
import type { CustomAgent } from "../interfaces/session-agents.interfaces";
import {
  addCustomAgent,
  canSaveDraft,
  draftProblem,
  emptyDraft,
  removeCustomAgent,
  sessionAgents,
  updateCustomAgent,
} from "./session-agents.functions";

const draft = { name: "Reviewer", command: "review run {prompt}" };

describe("draftProblem", () => {
  it("wants a name, a command, and somewhere to put the prompt", () => {
    expect(draftProblem({ ...draft, name: "  " })).toMatch(/name/);
    expect(draftProblem({ ...draft, command: "" })).toMatch(/command/);
    expect(draftProblem({ ...draft, command: "review run" })).toMatch(
      /{prompt}/
    );
    expect(draftProblem(draft)).toBeNull();
  });

  it("starts a fresh draft one name short of saveable", () => {
    expect(canSaveDraft(emptyDraft())).toBe(false);
    expect(canSaveDraft({ ...emptyDraft(), name: "Reviewer" })).toBe(true);
  });
});

describe("addCustomAgent", () => {
  it("appends the agent, trimmed", () => {
    const agents = addCustomAgent(
      [],
      { name: "  Reviewer ", command: " review run {prompt} " },
      "a1"
    );
    expect(agents).toEqual([
      { id: "a1", name: "Reviewer", command: "review run {prompt}" },
    ]);
  });

  it("refuses a draft that could not run", () => {
    expect(addCustomAgent([], { name: "", command: "" }, "a1")).toEqual([]);
  });
});

describe("updateCustomAgent", () => {
  const agents: ReadonlyArray<CustomAgent> = [
    { id: "a1", name: "Reviewer", command: "review run {prompt}" },
  ];

  it("rewrites the one it names and leaves the rest", () => {
    const next = updateCustomAgent(agents, "a1", {
      name: "Auditor",
      command: "audit {prompt}",
    });
    expect(next[0]).toEqual({
      id: "a1",
      name: "Auditor",
      command: "audit {prompt}",
    });
    expect(updateCustomAgent(agents, "missing", draft)).toEqual(agents);
  });

  it("refuses a draft that could not run", () => {
    expect(
      updateCustomAgent(agents, "a1", { name: "x", command: "x" })
    ).toEqual(agents);
  });
});

describe("removeCustomAgent", () => {
  it("drops the one it names", () => {
    const agents = [{ id: "a1", name: "R", command: "r {prompt}" }];
    expect(removeCustomAgent(agents, "a1")).toEqual([]);
    expect(removeCustomAgent(agents, "a2")).toEqual(agents);
  });
});

describe("sessionAgents", () => {
  it("lists the detected CLIs with the command reviewer runs, then the rest", () => {
    const strip = sessionAgents(
      ["claude", "codex"],
      [{ id: "a1", name: "Reviewer", command: "review run {prompt}" }]
    );
    expect(strip.map((agent) => agent.name)).toEqual([
      "Claude Code",
      "Codex",
      "Reviewer",
    ]);
    expect(strip[0]).toMatchObject({
      command: "claude -p {prompt}",
      detected: true,
    });
    expect(strip[2]).toMatchObject({ kind: "terminal", detected: false });
  });
});
