// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { KeyChord } from "../interfaces/search.interfaces";
import {
  DOUBLE_TAP_WINDOW_MS,
  NO_SHIFT_TAPS,
  isCommandChord,
  isGrepChord,
  isTypingTarget,
  nextShiftTap,
} from "./shortcuts.functions";

const chord = (over: Partial<KeyChord> = {}): KeyChord => ({
  key: "Shift",
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: true,
  repeat: false,
  ...over,
});

const tapTwice = (gap: number) => {
  const first = nextShiftTap(NO_SHIFT_TAPS, chord(), 1_000);
  return nextShiftTap(first.taps, chord(), 1_000 + gap);
};

describe("nextShiftTap", () => {
  it("opens on a second tap inside the window", () => {
    expect(tapTwice(120).doubleTapped).toBe(true);
  });

  it("still opens on a tap at the very edge of the window", () => {
    expect(tapTwice(DOUBLE_TAP_WINDOW_MS).doubleTapped).toBe(true);
  });

  it("treats a late second tap as a fresh first tap", () => {
    const outcome = tapTwice(DOUBLE_TAP_WINDOW_MS + 1);

    expect(outcome.doubleTapped).toBe(false);
    expect(outcome.taps.lastTapAt).toBe(1_000 + DOUBLE_TAP_WINDOW_MS + 1);
  });

  it("does not open twice on a third tap", () => {
    const opened = tapTwice(100);
    const third = nextShiftTap(opened.taps, chord(), 1_150);

    expect(third.doubleTapped).toBe(false);
  });

  it("forgets the first tap once another key is pressed between the two", () => {
    const first = nextShiftTap(NO_SHIFT_TAPS, chord(), 1_000);
    const typed = nextShiftTap(first.taps, chord({ key: "a" }), 1_050);
    const second = nextShiftTap(typed.taps, chord(), 1_100);

    expect(typed.taps).toEqual(NO_SHIFT_TAPS);
    expect(second.doubleTapped).toBe(false);
  });

  it("ignores the auto-repeat of a held Shift", () => {
    const first = nextShiftTap(NO_SHIFT_TAPS, chord(), 1_000);
    const held = nextShiftTap(first.taps, chord({ repeat: true }), 1_100);

    expect(held.doubleTapped).toBe(false);
    expect(held.taps).toEqual(first.taps);
  });

  it("does not count the Shift of a chord like ⌘⇧F", () => {
    const first = nextShiftTap(NO_SHIFT_TAPS, chord(), 1_000);
    const withMeta = nextShiftTap(first.taps, chord({ metaKey: true }), 1_050);

    expect(withMeta.doubleTapped).toBe(false);
    expect(withMeta.taps).toEqual(NO_SHIFT_TAPS);
  });
});

describe("isCommandChord", () => {
  it("matches ⌘K and Ctrl+K", () => {
    expect(
      isCommandChord(chord({ key: "k", metaKey: true, shiftKey: false }))
    ).toBe(true);
    expect(
      isCommandChord(chord({ key: "K", ctrlKey: true, shiftKey: false }))
    ).toBe(true);
  });

  it("leaves ⌘⇧K and a bare K alone", () => {
    expect(
      isCommandChord(chord({ key: "k", metaKey: true, shiftKey: true }))
    ).toBe(false);
    expect(isCommandChord(chord({ key: "k", shiftKey: false }))).toBe(false);
  });
});

describe("isGrepChord", () => {
  it("matches ⌘⇧F and Ctrl+Shift+F", () => {
    expect(isGrepChord(chord({ key: "f", metaKey: true }))).toBe(true);
    expect(isGrepChord(chord({ key: "F", ctrlKey: true }))).toBe(true);
  });

  it("ignores the same key without the full chord", () => {
    expect(
      isGrepChord(chord({ key: "f", metaKey: true, shiftKey: false }))
    ).toBe(false);
    expect(isGrepChord(chord({ key: "f" }))).toBe(false);
    expect(isGrepChord(chord({ key: "f", metaKey: true, altKey: true }))).toBe(
      false
    );
  });
});

describe("isTypingTarget", () => {
  it("recognises the places text is typed", () => {
    for (const tag of ["input", "textarea", "select"]) {
      expect(isTypingTarget(document.createElement(tag))).toBe(true);
    }

    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    expect(isTypingTarget(editable)).toBe(true);

    const insideEditable = document.createElement("span");
    editable.append(insideEditable);
    expect(isTypingTarget(insideEditable)).toBe(true);
  });

  it("leaves ordinary elements and a missing target alone", () => {
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
    expect(isTypingTarget(document.body)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
