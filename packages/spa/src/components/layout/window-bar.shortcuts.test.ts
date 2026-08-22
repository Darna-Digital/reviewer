import { describe, expect, it } from "vitest";
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
  it("gives the digits to the tabs alone, from ⌘1", () => {
    expect(chord("1")).toEqual({ kind: "session", slot: 1 });
    expect(chord("2")).toEqual({ kind: "session", slot: 2 });
    expect(chord("9")).toEqual({ kind: "session", slot: 9 });
  });

  it("crosses between the ways of working on ⌘G, off the digits", () => {
    expect(chord("g")).toEqual({ kind: "mode" });
    expect(chord("G", { shiftKey: true })).toBeNull();
  });

  it("leaves the launchpad on ⌘L, off the run of places", () => {
    expect(chord("l")).toEqual({ kind: "launchpad" });
    expect(chord("0")).toBeNull();
  });

  it("runs out at ⌘9", () => {
    expect(sessionDigit(9)).toBe(9);
    expect(sessionDigit(10)).toBeNull();
  });

  it("reads a digit rather than coercing one out of any key", () => {
    expect(chord(" ")).toBeNull();
    expect(chord("")).toBeNull();
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

  it("holds the launchpad to ⌘ alone as well", () => {
    expect(chord("L", { shiftKey: true })).toBeNull();
    expect(chord("l", { altKey: true })).toBeNull();
  });

  it("puts the panes on ⌘⇧A and ⌘⇧B, either side of the page", () => {
    expect(chord("a", { shiftKey: true })).toEqual({
      kind: "pane",
      pane: "analysis",
    });
    expect(chord("B", { shiftKey: true })).toEqual({
      kind: "pane",
      pane: "browser",
    });
  });

  it("raises the project chip's dropdown on ⌘⇧P", () => {
    expect(chord("p", { shiftKey: true })).toEqual({ kind: "project-picker" });
    expect(chord("P", { shiftKey: true })).toEqual({ kind: "project-picker" });
    expect(chord("p")).toBeNull();
  });

  it("leaves ⌘B to the bottom dock, and ⌘A to the page", () => {
    expect(chord("a")).toBeNull();
    expect(chord("b")).toBeNull();
  });

  it("answers Ctrl the same as ⌘", () => {
    expect(chord("1", { metaKey: false, ctrlKey: true })).toEqual({
      kind: "session",
      slot: 1,
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
