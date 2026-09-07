import { describe, expect, it, vi } from "vitest";
import { barShortcut } from "./window-bar.shortcuts";

vi.mock("@reviewer/feature-flags", () => ({
  isFeatureEnabled: (flag: string) => flag !== "sessions-button",
}));

const chord = (key: string) =>
  barShortcut({
    key,
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
  });

describe("a switched-off sessions button", () => {
  it("takes minting a session off ⌘T", () => {
    expect(chord("t")).toBeNull();
  });

  it("leaves the tabs on their digits, which are the strip's own", () => {
    expect(chord("1")).toEqual({ kind: "session", slot: 1 });
    expect(chord("2")).toEqual({ kind: "session", slot: 2 });
  });

  it("leaves ⌘G alone: the strip settles what there is to cross to", () => {
    expect(chord("g")).toEqual({ kind: "mode" });
  });

  it("leaves the launchpad on ⌘L, which is nothing to do with sessions", () => {
    expect(chord("l")).toEqual({ kind: "launchpad" });
  });
});
