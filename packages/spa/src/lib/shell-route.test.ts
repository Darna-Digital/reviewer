import { describe, expect, it } from "vitest";
import { shellRoute, showsGitChrome } from "./shell-route";

describe("shellRoute", () => {
  it("reads the three code modes off the path", () => {
    expect(shellRoute("/modes/code/commit", "code")).toEqual({
      kind: "code",
      mode: "commit",
    });
    expect(shellRoute("/modes/code/browse", "code")).toEqual({
      kind: "code",
      mode: "browse",
    });
    expect(shellRoute("/modes/code/browse/commit/abc123", "code")).toEqual({
      kind: "code",
      mode: "browse",
    });
    expect(shellRoute("/modes/code/review/7", "code")).toEqual({
      kind: "code",
      mode: "review",
    });
  });

  it("treats the workspace pages under /modes/code as workspace, not diff", () => {
    for (const page of ["docs", "tasks", "threads", "local-dev"]) {
      expect(shellRoute(`/modes/code/${page}`, "code")).toEqual({
        kind: "workspace",
      });
    }
  });

  it("recognises sessions, collaboration and settings", () => {
    expect(shellRoute("/modes/agent-session", "code")).toEqual({
      kind: "session",
    });
    expect(shellRoute("/modes/agent-session/abc", "code")).toEqual({
      kind: "session",
    });
    expect(shellRoute("/modes/collaboration", "code")).toEqual({
      kind: "collaboration",
    });
    expect(shellRoute("/modes/collaboration/inbox", "code")).toEqual({
      kind: "collaboration",
    });
    expect(shellRoute("/settings", "code")).toEqual({ kind: "settings" });
  });

  it("falls back to the remembered mode when the path does not say", () => {
    expect(shellRoute("/", "collaboration")).toEqual({ kind: "collaboration" });
    expect(shellRoute("/", "code")).toEqual({ kind: "code", mode: "commit" });
  });

  it("does not mistake a path that merely starts with a page name", () => {
    // `/modes/code/browse` is the diff; nothing else should be read as a page.
    expect(shellRoute("/modes/code/tasksomething", "code")).toEqual({
      kind: "code",
      mode: "commit",
    });
  });
});

describe("showsGitChrome", () => {
  it("is on for the code and workspace surfaces, off for the rest", () => {
    expect(showsGitChrome({ kind: "code", mode: "commit" })).toBe(true);
    expect(showsGitChrome({ kind: "workspace" })).toBe(true);
    expect(showsGitChrome({ kind: "session" })).toBe(false);
    expect(showsGitChrome({ kind: "collaboration" })).toBe(false);
    expect(showsGitChrome({ kind: "settings" })).toBe(false);
  });
});
