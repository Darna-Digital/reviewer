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
 */
import type {
  VimOutcome,
  VimPosition,
  VimState,
} from "../interfaces/vim.interfaces";
import { caretLeavingInsert, runCommand } from "./vim.commands";
import { parseNormal, parseVisual } from "./vim.keys";
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

  // Arrow keys and the like are not spelled with letters, so they go to the
  // editor — moving around with them in normal mode is nobody's mistake.
  if (key.key.length !== 1) return untouched(state, caret);

  const pending = state.pending + key.key;
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
