/**
 * The shapes Vim mode is expressed in.
 *
 * The whole emulation is a fold: a key and the state it arrives in produce the
 * next state and, when the keys have finished spelling a command, the edits to
 * apply. Nothing in here knows about the editor, the DOM or React — which is
 * what makes the grammar testable a key at a time.
 */
import type { TextEdit } from "@pierre/diffs/edit";

export type VimMode = "normal" | "insert" | "visual" | "visual-line";

/** Zero-based caret coordinates, as everything in the editor uses. */
export interface VimPosition {
  readonly line: number;
  readonly character: number;
}

/** What a yank or delete left behind, for `p` to put back. */
export interface VimRegister {
  readonly text: string;
  /** Whether it was taken as whole lines, which decides where `p` puts it. */
  readonly linewise: boolean;
}

export interface VimState {
  readonly mode: VimMode;
  /** Where a visual selection was started; null outside visual mode. */
  readonly anchor: VimPosition | null;
  readonly register: VimRegister | null;
  /**
   * Keys typed that have not yet spelled a command — `2d` waiting for a motion,
   * `g` waiting for its second `g`, `f` waiting for a character.
   */
  readonly pending: string;
}

/** Somewhere to move to. Counts are applied by the caller, not carried here. */
export type VimMotion =
  | { readonly kind: "left" }
  | { readonly kind: "right" }
  | { readonly kind: "up" }
  | { readonly kind: "down" }
  /** `w` / `W` — to the start of the next word. */
  | { readonly kind: "wordForward"; readonly big: boolean }
  /** `b` / `B` — back to the start of a word. */
  | { readonly kind: "wordBack"; readonly big: boolean }
  /** `e` / `E` — on to the end of a word. */
  | { readonly kind: "wordEnd"; readonly big: boolean }
  | { readonly kind: "lineStart" }
  | { readonly kind: "firstNonBlank" }
  | { readonly kind: "lineEnd" }
  /** `gg`, `G`, and `{count}G` / `{count}gg`. */
  | { readonly kind: "fileStart" }
  | { readonly kind: "fileEnd" }
  | { readonly kind: "goToLine"; readonly line: number }
  /** `f` `F` `t` `T` — to (or up to) a character on this line. */
  | {
      readonly kind: "findChar";
      readonly char: string;
      readonly forward: boolean;
      readonly till: boolean;
    }
  | { readonly kind: "halfPageDown" }
  | { readonly kind: "halfPageUp" };

export type VimOperator = "delete" | "change" | "yank" | "indent" | "outdent";

/** Where `i`, `a`, `o` and their capitals leave the caret. */
export type VimInsertAt =
  "before" | "after" | "lineStart" | "lineEnd" | "openBelow" | "openAbove";

/** A command the keys have finished spelling. */
export type VimCommand =
  | {
      readonly kind: "move";
      readonly motion: VimMotion;
      readonly count: number;
    }
  | {
      readonly kind: "operate";
      readonly operator: VimOperator;
      readonly motion: VimMotion;
      readonly count: number;
    }
  /** `dd`, `cc`, `yy`, `>>`, `<<` — the operator doubled, over whole lines. */
  | {
      readonly kind: "operateLines";
      readonly operator: VimOperator;
      readonly count: number;
    }
  | { readonly kind: "insert"; readonly at: VimInsertAt }
  /** `x` / `X`. */
  | {
      readonly kind: "deleteChar";
      readonly before: boolean;
      readonly count: number;
    }
  /** `r{char}`. */
  | { readonly kind: "replaceChar"; readonly char: string }
  /** `p` / `P`. */
  | { readonly kind: "put"; readonly after: boolean; readonly count: number }
  | { readonly kind: "join"; readonly count: number }
  | { readonly kind: "undo" }
  | { readonly kind: "redo" }
  | { readonly kind: "enterVisual"; readonly line: boolean }
  /** Escape, and everything else that just puts the caret back in normal mode. */
  | { readonly kind: "escape" }
  /** The visual-mode operators, which act on the selection rather than a motion. */
  | { readonly kind: "operateSelection"; readonly operator: VimOperator };

/** What parsing the keys so far came to. */
export type VimParse =
  /** A prefix of something longer — keep the keys and wait. */
  | { readonly kind: "pending" }
  /** Not a command at all; the keys are dropped. */
  | { readonly kind: "none" }
  | { readonly kind: "command"; readonly command: VimCommand };

/** What a key did, and what the caller has to carry out. */
export interface VimOutcome {
  readonly state: VimState;
  /** Edits to apply to the buffer, in one batch so one undo takes them back. */
  readonly edits: ReadonlyArray<TextEdit>;
  /** Where the caret goes afterwards. */
  readonly caret: VimPosition;
  /**
   * Whether the keystroke was Vim's. False lets it through to the editor, which
   * is how insert mode types and how a chord like ⌘S still saves.
   */
  readonly handled: boolean;
  /** Undo or redo to run on the editor — Vim's `u` and `⌃r`. */
  readonly history?: "undo" | "redo";
}

export const INITIAL_VIM_STATE: VimState = {
  mode: "normal",
  anchor: null,
  register: null,
  pending: "",
};
