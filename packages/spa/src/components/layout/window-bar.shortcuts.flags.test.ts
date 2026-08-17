import { describe, expect, it, vi } from "vitest";
import { PROJECT_TAB_ID } from "@/interactions/window-tabs/functions/window-tabs.functions";
import { barShortcut } from "./window-bar.shortcuts";

vi.mock("@byconvo/feature-flags", () => ({
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
  it("takes Sessions off ⌘2, as it is off the bar", () => {
    expect(chord("2")).toBeNull();
  });

  it("takes minting a session off ⌘T with it", () => {
    expect(chord("t")).toBeNull();
  });

  it("leaves the digits either side of it where they are", () => {
    expect(chord("1")).toEqual({ kind: "tab", tabId: PROJECT_TAB_ID });
    expect(chord("3")).toEqual({ kind: "session", slot: 1 });
  });

  it("leaves the launchpad on ⌘L, which is nothing to do with sessions", () => {
    expect(chord("l")).toEqual({ kind: "launchpad" });
  });
});
