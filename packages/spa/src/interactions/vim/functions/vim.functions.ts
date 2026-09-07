/**
 * One keystroke of Vim mode.
 *
 * Everything the emulation does goes through here: the key, the mode it arrives
 * in and the buffer it arrives at produce the next state, the edits to apply and
 * where the caret ends up. Two rules keep it out of the app's way.
 *
 * Insert mode is not emulated — it is the editor. Only Escape is taken; every
 * other keystroke is reported unhandled and lands in the buffer as it normally
 * would, which is how bracket matching, auto-surround, completions and the
 * editor's own bindings keep working while Vim mode is on.
 *
 * And a chord is never Vim's. ⌘S, ⌘F, ⌘/ and the rest belong to the app and to
 * the editor whichever mode is current; the only modified keys taken are the
 * three Vim itself defines — ⌃d, ⌃u and ⌃r.
 *
 * The arrows, Home and End are the exception to "spelled with letters": Vim
 * defines them as motions, and taking them as such is what stops them moving
 * the caret behind the emulation's back and collapsing a visual selection or
 * stranding a half-typed operator.
 */
import type {
  VimOutcome,
  VimPosition,
  VimState,
} from "../interfaces/vim.interfaces";
import { caretLeavingInsert, runCommand } from "./vim.commands";
import {
  awaitsCharArgument,
  NAVIGATION_MOTION_KEYS,
  parseNormal,
  parseVisual,
} from "./vim.keys";
import { clampCaret } from "./vim.motions";

/** The keystroke, reduced to what the grammar cares about. */
export interface VimKey {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

const untouched = (state: VimState, caret: VimPosition): VimOutcome => ({
  state,
  edits: [],
  caret,
  handled: false,
});

const toNormal = (
  state: VimState,
  lines: ReadonlyArray<string>,
  caret: VimPosition
): VimOutcome => ({
  state: { ...state, mode: "normal", anchor: null, pending: "" },
  edits: [],
  caret: clampCaret(lines, caret, false),
  handled: true,
});

/**
 * What `key` does to `state`.
 *
 * `caret` is where the caret is now, `lines` the buffer as the editor holds it.
 * An outcome with `handled: false` means the keystroke was never Vim's — let it
 * reach the editor untouched.
 */
export function onVimKey(
  state: VimState,
  lines: ReadonlyArray<string>,
  caret: VimPosition,
  key: VimKey
): VimOutcome {
  // A modifier key on its own is not a keystroke.
  if (["Shift", "Control", "Alt", "Meta"].includes(key.key)) {
    return untouched(state, caret);
  }

  if (key.key === "Escape") {
    if (state.mode === "insert") {
      return {
        state: { ...state, mode: "normal", anchor: null, pending: "" },
        edits: [],
        caret: caretLeavingInsert(lines, caret),
        handled: true,
      };
    }
    // In normal mode Escape only abandons a half-typed command, which is what
    // makes it safe to press when you have lost track of what you were doing.
    return toNormal(state, lines, caret);
  }

  if (state.mode === "insert") return untouched(state, caret);

  // The three chords Vim itself owns. Everything else modified belongs to the
  // app: ⌘S saves, ⌘F finds, ⌘/ comments, whatever mode this is in.
  if (key.ctrlKey && !key.metaKey && !key.altKey) {
    const lower = key.key.toLowerCase();
    if (lower === "d" || lower === "u") {
      return runCommand({ ...state, pending: "" }, lines, caret, {
        kind: "move",
        motion: { kind: lower === "d" ? "halfPageDown" : "halfPageUp" },
        count: 1,
      });
    }
    if (lower === "r") {
      return runCommand({ ...state, pending: "" }, lines, caret, {
        kind: "redo",
      });
    }
    return untouched(state, caret);
  }
  if (key.metaKey || key.altKey) return untouched(state, caret);

  // The arrows, Home and End are motions, spelled the way Vim spells them, so
  // they run through the grammar rather than round it. Left to the editor they
  // move the caret behind the emulation's back: a visual selection collapses
  // while the badge still claims one, an operator waiting for its motion is
  // stranded, and the next keystroke measures from an anchor that no longer
  // describes anything — which is the whole of "the arrows cancel Vim".
  const navigation = NAVIGATION_MOTION_KEYS[key.key];
  if (navigation !== undefined && awaitsCharArgument(state.pending)) {
    // `f` and an arrow: an arrow is not a character to search for, so the
    // half-typed command is dropped rather than sent looking for an "l".
    return {
      state: { ...state, pending: "" },
      edits: [],
      caret,
      handled: true,
    };
  }
  const typed = navigation ?? key.key;

  // Anything else spelled with more than one character — Tab, the function
  // keys, PageDown — is not part of the grammar, and goes to the editor.
  if (typed.length !== 1) return untouched(state, caret);

  const pending = state.pending + typed;
  const parsed =
    state.mode === "normal" ? parseNormal(pending) : parseVisual(pending);

  if (parsed.kind === "pending") {
    return {
      state: { ...state, pending },
      edits: [],
      caret,
      handled: true,
    };
  }
  if (parsed.kind === "none") {
    // An unrecognised run is dropped rather than left to poison the next
    // keystroke — and it is still swallowed, so stray letters never land in the
    // buffer while the caret is in normal mode.
    return {
      state: { ...state, pending: "" },
      edits: [],
      caret,
      handled: true,
    };
  }
  return runCommand(state, lines, caret, parsed.command);
}

/**
 * Where a press in the code leaves the mode.
 *
 * A press moves the caret itself and collapses whatever was selected, so the
 * anchor visual mode was measuring from no longer describes anything. Left
 * standing it is worse than useless: the next motion would extend a selection
 * from wherever visual mode was entered — possibly screens away — and until
 * that keystroke the indicator claims a selection that is not on screen.
 *
 * Normal and insert mode are untouched: a press there is just a caret move.
 */
export const afterPointerPress = (state: VimState): VimState =>
  state.mode === "visual" || state.mode === "visual-line"
    ? { ...state, mode: "normal", anchor: null, pending: "" }
    : state;

/** What the status line shows for a mode. */
export const modeLabel = (state: VimState): string => {
  switch (state.mode) {
    case "insert":
      return "INSERT";
    case "visual":
      return "VISUAL";
    case "visual-line":
      return "V-LINE";
    case "normal":
      return "NORMAL";
  }
};
