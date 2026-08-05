import type {
  KeyChord,
  ShiftTapOutcome,
  ShiftTaps,
} from "../interfaces/search.interfaces";

/**
 * How long a first Shift tap waits for its partner. Long enough to be
 * comfortable, short enough that two unrelated Shifts — capitalising two words
 * in a row — do not read as one gesture.
 */
export const DOUBLE_TAP_WINDOW_MS = 400;

export const NO_SHIFT_TAPS: ShiftTaps = { lastTapAt: null };

const idle = (taps: ShiftTaps): ShiftTapOutcome => ({
  taps,
  doubleTapped: false,
});

/**
 * Advance the double-tap state machine on a keydown. A tap only counts when
 * Shift is pressed *alone*: any other key — including Shift as part of a chord
 * like ⌘⇧F — breaks the pair, so a shortcut can never open the palette behind
 * itself. Auto-repeat from a held Shift is ignored rather than counted.
 */
export const nextShiftTap = (
  taps: ShiftTaps,
  event: KeyChord,
  now: number
): ShiftTapOutcome => {
  if (event.key !== "Shift") return idle(NO_SHIFT_TAPS);
  if (event.repeat) return idle(taps);
  if (event.metaKey || event.ctrlKey || event.altKey)
    return idle(NO_SHIFT_TAPS);
  if (taps.lastTapAt !== null && now - taps.lastTapAt <= DOUBLE_TAP_WINDOW_MS) {
    return { taps: NO_SHIFT_TAPS, doubleTapped: true };
  }
  return idle({ lastTapAt: now });
};

/** ⌘K / Ctrl+K — the command list the dialog opens on. */
export const isCommandChord = (event: KeyChord): boolean =>
  (event.metaKey || event.ctrlKey) &&
  !event.altKey &&
  !event.shiftKey &&
  event.key.toLowerCase() === "k";

/** ⌘⇧F / Ctrl+Shift+F — the content search. */
export const isGrepChord = (event: KeyChord): boolean =>
  (event.metaKey || event.ctrlKey) &&
  event.shiftKey &&
  !event.altKey &&
  event.key.toLowerCase() === "f";

/**
 * Whether the keystroke is being typed into something. Shift is a normal part
 * of writing, so the double-tap gesture stays out of editors and inputs.
 */
export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (target === null || !(target instanceof HTMLElement)) return false;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return true;
  // The attribute lookup is not redundant: jsdom never sets isContentEditable.
  return (
    target.isContentEditable ||
    target.closest("[contenteditable]:not([contenteditable='false'])") !== null
  );
};
