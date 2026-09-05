/**
 * Code folding, wired to the editor.
 *
 * Three things have to agree for a fold to behave: the rows have to disappear,
 * the caret must not walk into them, and the fold has to survive the buffer
 * changing under it.
 *
 * The rows are painted (see `fold-paint`) because the library has no API for
 * hiding a range. The caret is kept out by the one hook it does offer:
 * The editable `File` component declares `isLineRenderable`, `getNearestRenderableLine`
 * and `revealLine` as optional members that "components without collapsible
 * regions leave unimplemented", and the editor reads them off the attached
 * component on every vertical move. `onAttach` hands us that component, so a
 * plain file gets the implementation it never had — ↓ steps over a folded block
 * in one move, and anything that lands the caret inside one opens it.
 *
 * And the regions are recomputed from the buffer on every change, with folds
 * remembered by their header line and dropped when that line stops opening
 * anything. A fold that quietly slid onto the wrong block would be worse than
 * one that opened.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { File as EditableFile } from "@pierre/diffs";
import type { Editor } from "@pierre/diffs/edit";
import { codeRootOf } from "@/lib/code-root";
import {
  closeFold,
  foldAll,
  foldRegions,
  hiddenLines,
  openFold,
  survivingFolds,
  toggleFold,
  unfoldAll,
  visibleLine,
  nearestVisible,
  type FoldRegion,
} from "../functions/folding.functions";
import {
  FOLD_CSS,
  clearFolds,
  foldTargetOf,
  paintFolds,
} from "../functions/fold-paint";

export interface Folding {
  /** Close the fold at (or around) a zero-based line, or open it if closed. */
  readonly toggle: (line: number) => void;
  readonly close: (line: number) => void;
  readonly open: (line: number) => void;
  readonly closeAll: () => void;
  readonly openAll: () => void;
  /** Whether anything is folded — the tab strip shows an "unfold all" when so. */
  readonly hasFolds: boolean;
  /**
   * The nearest line at or beyond `line` that is not folded away. Anything
   * moving the caret itself has to go through this, or it lands somewhere the
   * reader cannot see — the editor only applies its own hooks to its own keys.
   */
  readonly visibleFrom: (line: number, direction: "up" | "down") => number;
  /** Spread into the view's `options` — merge the CSS with everything else's. */
  readonly viewOptions: {
    readonly unsafeCSS: string;
    readonly onPostRender: (
      node: HTMLElement,
      instance: unknown,
      phase: "mount" | "update" | "unmount"
    ) => void;
  };
  /**
   * Give the editor the collapsed-region hooks a plain file has none of. Call
   * from the editor's `onAttach`, which is where the component turns up.
   */
  readonly attach: (component: EditableFile<undefined, undefined>) => void;
}

interface FoldingOptions {
  /** The editable view's editor, or null while the file is only being read. */
  readonly editor: Editor<"file"> | null;
  /** What is on disk, for a view with no live buffer to read. */
  readonly contents: string;
  /** Buffer-change subscription, so the regions follow the text. */
  readonly subscribe?: (listener: () => void) => () => void;
  /** Whether the caret is in the code — chords elsewhere are not ours. */
  readonly isFocused?: () => boolean;
}

export function useFolding({
  editor,
  contents,
  subscribe,
  isFocused,
}: FoldingOptions): Folding {
  const [closed, setClosed] = useState<ReadonlySet<number>>(new Set());
  /** The buffer as it stands, so the regions are of what is on screen. */
  const [text, setText] = useState(contents);
  const container = useRef<HTMLElement | null>(null);

  useEffect(() => setText(contents), [contents]);
  useEffect(() => {
    if (subscribe === undefined || editor === null) return;
    return subscribe(() => setText(editor.getText()));
  }, [editor, subscribe]);

  const lines = useMemo(() => text.split("\n"), [text]);
  const regions = useMemo<ReadonlyArray<FoldRegion>>(
    () => foldRegions(lines),
    [lines]
  );

  // An edit can turn a header into an ordinary line. Reconciling here rather
  // than in every command keeps the set honest however it was changed.
  const live = useMemo(
    () => survivingFolds(regions, closed),
    [regions, closed]
  );
  const hidden = useMemo(() => hiddenLines(regions, live), [regions, live]);
  const foldable = useMemo(
    () => new Set(regions.map((region) => region.start)),
    [regions]
  );

  // Refs so the painter and the editor's hooks stay stable across renders while
  // still seeing the current fold state.
  const state = useRef({ hidden, foldable, closed: live, regions, lines });
  state.current = { hidden, foldable, closed: live, regions, lines };

  const paint = useCallback(() => {
    const node = container.current;
    if (node === null) return;
    const now = state.current;
    // The rows are in the view's shadow root; `onPostRender` hands back its
    // host, and a query on the host reaches none of them.
    paintFolds(codeRootOf(node), {
      hidden: now.hidden,
      foldable: now.foldable,
      closed: now.closed,
    });
  }, []);

  useEffect(paint, [paint, hidden, foldable, live]);
  useEffect(
    () => () => {
      const node = container.current;
      if (node !== null) clearFolds(codeRootOf(node));
    },
    []
  );

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

  /**
   * Fold state changes move rows, and the caret overlay is positioned from
   * where those rows were. Re-setting the selection is what makes the editor
   * measure again — and it puts a caret that is now inside a fold back on the
   * header, which is the only place it can still be seen.
   */
  const settle = useCallback(
    (next: ReadonlySet<number>) => {
      setClosed(next);
      if (editor === null) return;
      const selection = editor.getViewState().selections?.at(-1);
      if (selection === undefined) return;
      const nowHidden = hiddenLines(state.current.regions, next);
      const line = visibleLine(
        nowHidden,
        state.current.regions,
        next,
        selection.start.line
      );
      const caret = {
        line,
        character:
          line === selection.start.line ? selection.start.character : 0,
      };
      editor.setSelections([{ start: caret, end: caret, direction: "none" }]);
    },
    [editor]
  );

  const toggle = useCallback(
    (line: number) =>
      settle(toggleFold(state.current.regions, state.current.closed, line)),
    [settle]
  );
  const close = useCallback(
    (line: number) =>
      settle(closeFold(state.current.regions, state.current.closed, line)),
    [settle]
  );
  const open = useCallback(
    (line: number) =>
      settle(openFold(state.current.regions, state.current.closed, line)),
    [settle]
  );
  const closeAll = useCallback(
    () => settle(foldAll(state.current.regions)),
    [settle]
  );
  const openAll = useCallback(() => settle(unfoldAll()), [settle]);

  // Clicking the chevron, or the `⋯` on a folded line — the only part of a
  // folded block still on screen to click.
  useEffect(() => {
    const onClick = (event: Event) => {
      const line = foldTargetOf(event);
      if (line === null) return;
      event.preventDefault();
      event.stopPropagation();
      toggle(line);
    };
    window.addEventListener("pointerdown", onClick, true);
    return () => window.removeEventListener("pointerdown", onClick, true);
  }, [toggle]);

  // ⌘⌥[ and ⌘⌥], as in VS Code, plus ⌘K⌘0 / ⌘K⌘J spelled without the chord.
  useEffect(() => {
    if (editor === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.altKey) return;
      if (isFocused?.() === false) return;
      const caret = editor.getViewState().selections?.at(-1)?.start.line ?? 0;
      if (event.key === "[" || event.code === "BracketLeft") {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) closeAll();
        else close(caret);
      } else if (event.key === "]" || event.code === "BracketRight") {
        event.preventDefault();
        event.stopPropagation();
        if (event.shiftKey) openAll();
        else open(caret);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [close, closeAll, editor, isFocused, open, openAll]);

  /**
   * The collapsed-region hooks, handed to the file component the editor
   * attached to. They are read on every vertical move, so they answer from the
   * ref rather than from the render that installed them.
   */
  const attach = useCallback(
    (component: EditableFile<undefined, undefined>) => {
      const target = component as EditableFile<undefined, undefined> & {
        isLineRenderable?: (line: number) => boolean;
        getNearestRenderableLine?: (
          line: number,
          direction: "up" | "down"
        ) => number | undefined;
        revealLine?: (line: number) => boolean;
      };
      // One-based lines at this boundary; zero-based everywhere inside.
      target.isLineRenderable = (line) => !state.current.hidden.has(line - 1);
      target.getNearestRenderableLine = (line, direction) => {
        const found = nearestVisible(
          state.current.hidden,
          line - 1,
          direction,
          state.current.lines.length
        );
        return found === undefined ? undefined : found + 1;
      };
      // Anything that puts the caret inside a fold opens it — a jump to a
      // definition should never land somewhere invisible.
      //
      // Deliberately not through `settle`: that moves the selection, the editor
      // answers a moved selection by asking whether the line is renderable, and
      // an unrenderable one brings it straight back here. Opening the fold is
      // the whole job; the editor re-renders and puts its own caret right.
      target.revealLine = (line) => {
        if (!state.current.hidden.has(line - 1)) return false;
        setClosed(
          openFold(state.current.regions, state.current.closed, line - 1)
        );
        return true;
      };
    },
    []
  );

  return {
    toggle,
    close,
    open,
    closeAll,
    openAll,
    hasFolds: live.size > 0,
    visibleFrom: useCallback((line: number, direction: "up" | "down") => {
      const now = state.current;
      if (!now.hidden.has(line)) return line;
      return (
        nearestVisible(now.hidden, line, direction, now.lines.length) ??
        nearestVisible(
          now.hidden,
          line,
          direction === "down" ? "up" : "down",
          now.lines.length
        ) ??
        line
      );
    }, []),
    viewOptions: { unsafeCSS: FOLD_CSS, onPostRender },
    attach,
  };
}
