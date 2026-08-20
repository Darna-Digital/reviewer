/**
 * Vim mode, wired to the editor.
 *
 * The grammar lives in `functions/`; this is the part that has to touch the
 * outside world — the keystrokes, the buffer, the caret, the gutter and the
 * shadow root the code is rendered into.
 *
 * Keys are taken on `window` in the capture phase, because normal mode has to
 * swallow ordinary letters before the editor types them. That is also why the
 * grammar is careful about what it refuses: a chord is never Vim's, so ⌘S, ⌘F
 * and ⌘/ still reach the app and the editor whichever mode the caret is in, and
 * insert mode passes everything but Escape straight through — bracket matching,
 * auto-surround and completions are the editor's, and they keep working.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DIFFS_TAG_NAME } from "@pierre/diffs";
import type { Editor } from "@pierre/diffs/edit";
import {
  INITIAL_VIM_STATE,
  type VimFoldAction,
  type VimMode,
  type VimPosition,
  type VimState,
} from "../interfaces/vim.interfaces";
import { onVimKey } from "../functions/vim.functions";
import { visualRange } from "../functions/vim.commands";
import {
  clearRelativeLines,
  paintRelativeLines,
} from "../functions/relative-lines";
import { VimStatus } from "../components/vim-status";

/**
 * A block caret while the keys mean commands, and the editor's own line caret
 * while they mean text — the one piece of state a modal editor has to make
 * visible at the point the eye already is.
 *
 * `!important` because the editor's own `[data-caret] { width: 2px }` is in a
 * stylesheet that outranks anything handed to it through `unsafeCSS`, whatever
 * the specificity — measured, not assumed.
 */
export const VIM_CSS = `
:host([data-vim-mode="normal"]) [data-caret],
:host([data-vim-mode="visual"]) [data-caret],
:host([data-vim-mode="visual-line"]) [data-caret] {
  width: 1ch !important;
  opacity: 0.55 !important;
  animation: none !important;
}
`;

interface VimOptions {
  /** The editable view's editor, or null while the file is only being read. */
  readonly editor: Editor<undefined> | null;
  /** Whether the user has Vim mode switched on. */
  readonly enabled: boolean;
  /** Whether the caret is in the code — keys elsewhere are not Vim's. */
  readonly isFocused?: () => boolean;
  /** Buffer-change subscription, so the gutter follows the text. */
  readonly subscribe?: (listener: () => void) => () => void;
  /**
   * Carry out a `z` command. Folding belongs to the view, not to the buffer, so
   * the grammar names the action and this hands it on.
   */
  readonly onFold?: (action: VimFoldAction, line: number) => void;
  /**
   * The nearest line at or beyond one that is not folded away.
   *
   * The motions work out where the caret goes themselves and set it, so the
   * editor's own fold-skipping never sees them — `j` would walk into a closed
   * block and leave the caret somewhere invisible. Every landing goes through
   * here instead.
   */
  readonly visibleFrom?: (line: number, direction: "up" | "down") => number;
}

export interface Vim {
  /**
   * The current mode, or null when Vim mode is off. Completions hang off this:
   * a list offering to finish a word makes no sense while `d` means delete.
   */
  readonly mode: VimMode | null;
  /**
   * Whether visual mode currently covers anything. `v` on its own is a mode,
   * not a passage — an offer to comment on it would have nothing to attach to.
   */
  readonly hasSelection: boolean;
  /** The mode indicator. Render it beside the file's other controls. */
  readonly status: React.ReactNode;
  /** Spread into the view's `options` — merge the CSS with everything else's. */
  readonly viewOptions: {
    readonly unsafeCSS: string;
    readonly onPostRender: (
      node: HTMLElement,
      instance: unknown,
      phase: "mount" | "update" | "unmount"
    ) => void;
  };
}

export function useVim({
  editor,
  enabled,
  isFocused,
  subscribe,
  onFold,
  visibleFrom,
}: VimOptions): Vim {
  const [state, setState] = useState<VimState>(INITIAL_VIM_STATE);
  /** Whether the visual selection covers more than the caret's own character. */
  const [spanning, setSpanning] = useState(false);
  const container = useRef<HTMLElement | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const active = enabled && editor !== null;

  /** Where the caret is, as the grammar wants it. */
  const caretOf = useCallback((): VimPosition => {
    const selection = editor?.getState().selections?.at(-1);
    if (selection === undefined) return { line: 0, character: 0 };
    return {
      line: selection.start.line,
      character: selection.start.character,
    };
  }, [editor]);

  // The gutter and the caret's shape both follow the mode and the caret line,
  // and both live in the shadow root, so they are painted together.
  //
  // The mode goes on the shadow *host*, which is what `onPostRender` hands back
  // — the caret CSS keys off it from inside with `:host([data-vim-mode=…])`, and
  // an element does not turn up in its own `querySelectorAll`.
  const paint = useCallback(() => {
    const node = container.current;
    if (node === null) return;
    const host = node.tagName.toLowerCase() === DIFFS_TAG_NAME ? node : null;
    if (host !== null) {
      if (active) host.setAttribute("data-vim-mode", stateRef.current.mode);
      else host.removeAttribute("data-vim-mode");
    }
    if (!active) {
      clearRelativeLines(node);
      return;
    }
    paintRelativeLines(node, caretOf().line);
  }, [active, caretOf]);

  const onPostRender = useCallback(
    (node: HTMLElement, _instance: unknown, phase: string) => {
      if (phase === "unmount") {
        container.current = null;
        return;
      }
      container.current = node;
      paint();
    },
    [paint]
  );

  // Repaint whenever the mode changes, whenever the buffer does, and once when
  // the switch is flipped either way.
  useEffect(paint, [paint, state.mode]);
  useEffect(() => subscribe?.(paint), [paint, subscribe]);

  // The gutter counts from the caret, and the caret moves in ways the buffer
  // never hears about — a click into the code, an arrow key in insert mode. The
  // editor has no selection callback to hang this off, but the document fires
  // `selectionchange` for a selection inside a shadow root just the same, which
  // is the one signal that covers every way the caret can travel.
  useEffect(() => {
    if (!active) return;
    const repaint = () => requestAnimationFrame(paint);
    document.addEventListener("selectionchange", repaint);
    window.addEventListener("keyup", repaint, true);
    return () => {
      document.removeEventListener("selectionchange", repaint);
      window.removeEventListener("keyup", repaint, true);
    };
  }, [active, paint]);
  useEffect(
    () => () => {
      if (container.current !== null) clearRelativeLines(container.current);
    },
    []
  );

  // A file opened while a command was half-typed would otherwise inherit it,
  // and a view that is no longer editable has no mode at all.
  useEffect(() => {
    if (!active) {
      setState(INITIAL_VIM_STATE);
      setSpanning(false);
    }
  }, [active]);

  useEffect(() => {
    if (!active || editor === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isFocused?.() === false) return;
      const lines = editor.getText().split("\n");
      const caret = caretOf();
      const outcome = onVimKey(stateRef.current, lines, caret, {
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
      });
      if (!outcome.handled) return;
      event.preventDefault();
      event.stopPropagation();

      stateRef.current = outcome.state;
      setState(outcome.state);
      if (outcome.fold !== undefined) {
        onFold?.(outcome.fold, outcome.caret.line);
        return;
      }
      if (outcome.history !== undefined) {
        if (outcome.history === "undo") editor.undo();
        else editor.redo();
        // Undo restores its own selection; the gutter still has to follow.
        requestAnimationFrame(paint);
        return;
      }
      // One batch, so `u` takes the whole command back rather than half of it.
      if (outcome.edits.length > 0) editor.applyEdits([...outcome.edits], true);

      // A motion that landed inside a closed fold carries on to the far side of
      // it, the way ↓ does — a caret you cannot see is worse than one that
      // travelled further than asked.
      const landed =
        visibleFrom === undefined
          ? outcome.caret
          : (() => {
              const line = visibleFrom(
                outcome.caret.line,
                outcome.caret.line >= caret.line ? "down" : "up"
              );
              return line === outcome.caret.line
                ? outcome.caret
                : { line, character: 0 };
            })();

      const mode = outcome.state.mode;
      setSpanning(
        mode === "visual-line" ||
          (mode === "visual" &&
            outcome.state.anchor !== null &&
            (outcome.state.anchor.line !== landed.line ||
              outcome.state.anchor.character !== landed.character))
      );
      if (mode === "visual" || mode === "visual-line") {
        const [from, to] = visualRange(outcome.state, landed);
        const after = editor.getText().split("\n");
        editor.setSelections([
          {
            start:
              mode === "visual-line" ? { line: from.line, character: 0 } : from,
            end:
              mode === "visual-line"
                ? {
                    line: to.line,
                    character: (after[to.line] ?? "").length,
                  }
                : {
                    line: to.line,
                    character: Math.min(
                      to.character + 1,
                      (after[to.line] ?? "").length
                    ),
                  },
            direction: "forward",
          },
        ]);
      } else {
        editor.setSelections([
          { start: landed, end: landed, direction: "none" },
        ]);
      }
      paint();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [active, caretOf, editor, isFocused, onFold, paint, visibleFrom]);

  const status = useMemo(
    () => (active ? <VimStatus state={state} /> : null),
    [active, state]
  );

  return {
    mode: active ? state.mode : null,
    hasSelection: active && spanning,
    status,
    // Always handed over, never conditionally: `File` reads its options when it
    // mounts, and the editor this hook needs is built during that very mount —
    // so CSS added once vim is "active" would arrive a render too late. The
    // rules are keyed off `data-vim-mode` on the host, which is the real
    // switch, and do nothing at all while it is absent.
    viewOptions: { unsafeCSS: VIM_CSS, onPostRender },
  };
}
