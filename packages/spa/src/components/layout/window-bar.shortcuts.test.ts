import { describe, expect, it } from "vitest";
import {
  PROJECT_TAB_ID,
  SESSIONS_TAB_ID,
} from "@/interactions/window-tabs/functions/window-tabs.functions";
import { barShortcut, sessionDigit } from "./window-bar.shortcuts";

const chord = (key: string, held: Partial<KeyboardEvent> = {}) =>
  barShortcut({
    key,
    metaKey: true,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...held,
  });

describe("the window bar's chords", () => {
  it("puts the three places it leads with on ⌘1, ⌘2 and ⌘3", () => {
    expect(chord("1")).toEqual({ kind: "launchpad" });
    expect(chord("2")).toEqual({ kind: "tab", tabId: PROJECT_TAB_ID });
    expect(chord("3")).toEqual({ kind: "tab", tabId: SESSIONS_TAB_ID });
  });

  it("carries on along the sessions from ⌘4", () => {
    expect(chord("4")).toEqual({ kind: "session", slot: 1 });
    expect(chord("5")).toEqual({ kind: "session", slot: 2 });
    expect(chord("9")).toEqual({ kind: "session", slot: 6 });
  });

  it("runs out at ⌘9, and has nothing on ⌘0", () => {
    expect(sessionDigit(6)).toBe(9);
    expect(sessionDigit(7)).toBeNull();
    expect(chord("0")).toBeNull();
  });

  it("holds the three to ⌘ alone, whatever else is pressed with it", () => {
    expect(chord("1", { shiftKey: true })).toBeNull();
    expect(chord("!", { shiftKey: true })).toBeNull();
    expect(chord("1", { altKey: true })).toBeNull();
    expect(chord("1", { metaKey: false })).toBeNull();
  });

  it("mints a session on ⌘T, and leaves ⌘⇧T to the browser", () => {
    expect(chord("t")).toEqual({ kind: "new-session" });
    expect(chord("T", { shiftKey: true })).toBeNull();
  });

  it("answers Ctrl the same as ⌘", () => {
    expect(chord("1", { metaKey: false, ctrlKey: true })).toEqual({
      kind: "launchpad",
    });
  });

  it("stays out of the chords the rest of the app is on", () => {
    expect(chord("k")).toBeNull();
    expect(chord("b")).toBeNull();
    expect(chord("s")).toBeNull();
    expect(chord(",")).toBeNull();
    expect(chord("F", { shiftKey: true })).toBeNull();
  });
});
