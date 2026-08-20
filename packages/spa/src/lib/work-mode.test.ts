import { describe, expect, it } from "vitest";
import type { WorkMode } from "./ui-prefs";
import { activeWorkMode, nextWorkMode, workModeTabs } from "./work-mode";

const modes = workModeTabs();

/** What the next mode is called, so the run reads as the strip does. */
const after = (active: WorkMode, strip = modes): string | null =>
  nextWorkMode(strip, active)?.mode ?? null;

describe("which mode a path is in", () => {
  it("reads the mode out of the path, whichever was picked last", () => {
    expect(activeWorkMode("/modes/collaboration", "code")).toBe(
      "collaboration"
    );
    expect(activeWorkMode("/modes/code/review", "collaboration")).toBe("code");
  });

  it("frames a session as code — it is the code you keep", () => {
    expect(activeWorkMode("/modes/agent-session/abc", "collaboration")).toBe(
      "code"
    );
  });

  it("falls back to the last pick where the path names no mode", () => {
    expect(activeWorkMode("/settings", "collaboration")).toBe("collaboration");
    expect(activeWorkMode("/settings", "code")).toBe("code");
  });
});

describe("the modes on offer", () => {
  it("offers both while collaboration is switched on", () => {
    expect(modes.map((mode) => mode.mode)).toEqual(["code", "collaboration"]);
  });

  it("points each at a page of its own", () => {
    expect(new Set(modes.map((mode) => mode.to)).size).toBe(modes.length);
  });
});

describe("the mode ⌘G moves to", () => {
  it("takes the next one along", () => {
    expect(after("code")).toBe("collaboration");
  });

  it("wraps at the end, so the one chord covers the strip", () => {
    expect(after("collaboration")).toBe("code");
  });

  it("has nowhere to go when there is a single mode", () => {
    expect(after("code", modes.slice(0, 1))).toBeNull();
    expect(after("code", [])).toBeNull();
  });

  it("lands on the first when the mode in hand is off the strip", () => {
    expect(after("editor" as WorkMode)).toBe("code");
  });
});
