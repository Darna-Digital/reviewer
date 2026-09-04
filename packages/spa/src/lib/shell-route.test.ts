import { describe, expect, it } from "vitest";
import {
  dockPage,
  dockPages,
  isBrowsingCode,
  reviewHref,
  reviewSourceOf,
  shellRoute,
  showsGitChrome,
} from "./shell-route";

describe("shellRoute", () => {
  it("reads a cloud run as a session, like a local conversation", () => {
    expect(shellRoute("/modes/agent-session/cloud/run-1", "code")).toEqual({
      kind: "session",
      composing: false,
      solo: false,
    });
    expect(
      shellRoute("/modes/agent-session/cloud/run-1", "code", false, true)
    ).toEqual({ kind: "session", composing: false, solo: true });
  });

  it("reads the two code modes off the path", () => {
    expect(shellRoute("/modes/code/review", "code")).toEqual({
      kind: "code",
      mode: "review",
    });
    expect(shellRoute("/modes/code/browse", "code")).toEqual({
      kind: "code",
      mode: "browse",
    });
    expect(shellRoute("/modes/code/browse/commit/abc123", "code")).toEqual({
      kind: "code",
      mode: "browse",
    });
    expect(shellRoute("/modes/code/review/pull/12", "code")).toEqual({
      kind: "code",
      mode: "review",
    });
  });

  it("treats the workspace pages under /modes/code as workspace, not diff", () => {
    for (const page of ["docs", "tasks", "reviews"]) {
      expect(shellRoute(`/modes/code/${page}`, "code")).toEqual({
        kind: "workspace",
      });
    }
  });

  it("names the dock surface a dock page stands for", () => {
    expect(shellRoute("/modes/code/branches", "code")).toEqual({
      kind: "dock",
      tab: "branches",
    });
    expect(shellRoute("/modes/code/history", "code")).toEqual({
      kind: "dock",
      tab: "history",
    });
    expect(shellRoute("/modes/code/local-dev", "code")).toEqual({
      kind: "dock",
      tab: "services",
    });
    expect(shellRoute("/modes/code/threads", "code")).toEqual({
      kind: "dock",
      tab: "threads",
    });
  });

  it("keeps a dock page's card, tab and trail on one name", () => {
    for (const page of dockPages) {
      expect(dockPage(page.tab)).toEqual(page);
      expect(shellRoute(page.href, "code")).toEqual({
        kind: "dock",
        tab: page.tab,
      });
    }
  });

  it("recognises sessions, collaboration and settings", () => {
    expect(shellRoute("/modes/agent-session", "code")).toEqual({
      kind: "session",
      composing: false,
      solo: false,
    });
    expect(shellRoute("/modes/agent-session", "code", true)).toEqual({
      kind: "session",
      composing: true,
      solo: false,
    });
    expect(shellRoute("/modes/agent-session/abc", "code")).toEqual({
      kind: "session",
      composing: false,
      solo: false,
    });
    // The same conversation, on a tab of its own: the shell drops the rail,
    // whose every button acts on a list that is not beside it there.
    expect(shellRoute("/modes/agent-session/abc", "code", false, true)).toEqual(
      { kind: "session", composing: false, solo: true }
    );
    expect(shellRoute("/modes/collaboration", "code")).toEqual({
      kind: "collaboration",
    });
    expect(shellRoute("/modes/collaboration/projects/p1", "code")).toEqual({
      kind: "collaboration",
    });
    // The prototype reads as itself rather than as the mode it was the first
    // draft of — the shell puts different chrome around each.
    expect(shellRoute("/modes/experimentation/collaboration", "code")).toEqual({
      kind: "experimentation",
    });
    expect(
      shellRoute("/modes/experimentation/collaboration/inbox", "code")
    ).toEqual({ kind: "experimentation" });
    expect(shellRoute("/settings", "code")).toEqual({ kind: "settings" });
  });

  it("falls back to the remembered mode when the path does not say", () => {
    expect(shellRoute("/", "collaboration")).toEqual({ kind: "collaboration" });
    expect(shellRoute("/", "code")).toEqual({ kind: "code", mode: "review" });
  });

  it("does not mistake a path that merely starts with a page name", () => {
    // `/modes/code/browse` is the diff; nothing else should be read as a page.
    expect(shellRoute("/modes/code/tasksomething", "code")).toEqual({
      kind: "code",
      mode: "review",
    });
  });
});

describe("showsGitChrome", () => {
  it("is on for the code and workspace surfaces, off for the rest", () => {
    expect(showsGitChrome({ kind: "code", mode: "review" })).toBe(true);
    expect(showsGitChrome({ kind: "workspace" })).toBe(true);
    expect(showsGitChrome({ kind: "dock", tab: "history" })).toBe(true);
    expect(
      showsGitChrome({ kind: "session", composing: false, solo: false })
    ).toBe(false);
    expect(showsGitChrome({ kind: "collaboration" })).toBe(false);
    expect(showsGitChrome({ kind: "settings" })).toBe(false);
  });
});

describe("reviewSourceOf", () => {
  it("reads the bare path as the changes in this checkout", () => {
    expect(reviewSourceOf("/modes/code/review")).toEqual({ kind: "local" });
  });

  it("reads a pull request's number", () => {
    expect(reviewSourceOf("/modes/code/review/pull/12")).toEqual({
      kind: "pull",
      number: 12,
    });
  });

  it("is nothing for the list beside it, which only shares a prefix", () => {
    expect(reviewSourceOf("/modes/code/reviews")).toBeNull();
    expect(reviewSourceOf("/modes/code/browse")).toBeNull();
  });

  it("is nothing for a shape it does not recognise", () => {
    expect(reviewSourceOf("/modes/code/review/branch")).toBeNull();
    expect(reviewSourceOf("/modes/code/review/pull/not-a-number")).toBeNull();
  });

  it("round-trips every source through its href", () => {
    for (const source of [
      { kind: "local" },
      { kind: "pull", number: 4 },
    ] as const) {
      expect(reviewSourceOf(reviewHref(source))).toEqual(source);
    }
  });
});

describe("isBrowsingCode", () => {
  it("accepts the browser and whatever it is browsing", () => {
    expect(isBrowsingCode("/modes/code/browse")).toBe(true);
    expect(isBrowsingCode("/modes/code/browse/commit/abc123")).toBe(true);
    expect(isBrowsingCode("/modes/code/browse/range")).toBe(true);
  });

  it("rejects the other code pages, whose context a file would contradict", () => {
    expect(isBrowsingCode("/modes/code/commit")).toBe(false);
    expect(isBrowsingCode("/modes/code/review/42")).toBe(false);
    expect(isBrowsingCode("/modes/code/find")).toBe(false);
  });

  it("rejects everything outside code mode", () => {
    expect(isBrowsingCode("/modes/agent-session/c1")).toBe(false);
    expect(isBrowsingCode("/modes/collaboration")).toBe(false);
    expect(isBrowsingCode("/settings")).toBe(false);
  });

  it("does not take a longer segment for the browser", () => {
    expect(isBrowsingCode("/modes/code/browser")).toBe(false);
  });
});
