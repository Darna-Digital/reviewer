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
 */
export const VIM_CSS = `
:host([data-vim-mode="normal"]) [data-caret],
:host([data-vim-mode="visual"]) [data-caret],
:host([data-vim-mode="visual-line"]) [data-caret] {
  width: 1ch;
  opacity: 0.55;
  animation: none;
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
}

export interface Vim {
  /**
   * The current mode, or null when Vim mode is off. Completions hang off this:
   * a list offering to finish a word makes no sense while `d` means delete.
   */
  readonly mode: VimMode | null;
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
}: VimOptions): Vim {
  const [state, setState] = useState<VimState>(INITIAL_VIM_STATE);
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
  const paint = useCallback(() => {
    const node = container.current;
    if (node === null) return;
    for (const host of node.querySelectorAll(DIFFS_TAG_NAME)) {
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
  useEffect(
    () => () => {
      if (container.current !== null) clearRelativeLines(container.current);
    },
    []
  );

  // A file opened while a command was half-typed would otherwise inherit it,
  // and a view that is no longer editable has no mode at all.
  useEffect(() => {
    if (!active) setState(INITIAL_VIM_STATE);
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
      if (outcome.history !== undefined) {
        if (outcome.history === "undo") editor.undo();
        else editor.redo();
        // Undo restores its own selection; the gutter still has to follow.
        requestAnimationFrame(paint);
        return;
      }
      // One batch, so `u` takes the whole command back rather than half of it.
      if (outcome.edits.length > 0) editor.applyEdits([...outcome.edits], true);

      const mode = outcome.state.mode;
      if (mode === "visual" || mode === "visual-line") {
        const [from, to] = visualRange(outcome.state, outcome.caret);
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
          { start: outcome.caret, end: outcome.caret, direction: "none" },
        ]);
      }
      paint();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [active, caretOf, editor, isFocused, paint]);

  const status = useMemo(
    () => (active ? <VimStatus state={state} /> : null),
    [active, state]
  );

  return {
    mode: active ? state.mode : null,
    status,
    viewOptions: { unsafeCSS: active ? VIM_CSS : "", onPostRender },
  };
}
