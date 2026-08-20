import { describe, expect, it, vi } from "vitest";
import { barShortcut } from "./window-bar.shortcuts";

vi.mock("@byconvo/feature-flags", () => ({
  isFeatureEnabled: (flag: string) => flag !== "collaboration-button",
}));

const chord = (key: string) =>
  barShortcut({
    key,
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
  });

describe("a switched-off collaboration mode", () => {
  it("leaves ⌘G alone — a single mode has nowhere to cycle to", () => {
    expect(chord("g")).toBeNull();
  });

  it("leaves the chords either side of it where they are", () => {
    expect(chord("l")).toEqual({ kind: "launchpad" });
    expect(chord("t")).toEqual({ kind: "new-session" });
  });
});
