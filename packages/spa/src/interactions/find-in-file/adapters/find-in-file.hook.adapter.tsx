/**
 * ⌘F for the open file, in whichever of its two modes it happens to be.
 *
 * The gesture is taken on `window` in the capture phase, which is the whole
 * trick: `@pierre/diffs` binds its own find panel to the code element, and an
 * event stopped before it reaches there never opens it. So the editable view
 * gets this bar rather than the library's, and the read-only view gets a bar at
 * all — it never had one, because there is no editor under it to have provided
 * one.
 *
 * Matches come from the text, never from the DOM: the buffer while the file is
 * being edited, so a match appears the moment it is typed, and the loaded
 * contents while it is only being read. That is also why the count is honest in
 * a virtualised view, where most of the file is not rendered at all.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@pierre/diffs/edit";
import {
  useRevealLine,
  type RevealTarget,
} from "@/interactions/language/components/use-reveal-line";
import { selectedTextInCode } from "@/lib/code-root";
import { FindBar } from "../components/find-bar";
import {
  DEFAULT_FIND_OPTIONS,
  findMatches,
  findStatus,
  indexFrom,
  seedFromSelection,
  sliceRange,
  stepIndex,
} from "../functions/find-in-file.functions";
import {
  FIND_CSS,
  clearFindMarks,
  paintFindMatches,
  topVisibleLine,
} from "../functions/find-marks";
import type {
  FindAnchor,
  FindDirection,
  FindOptions,
} from "../interfaces/find-in-file.interfaces";
import { registerCodeSelection } from "./code-selection.store";

interface FindInFileOptions {
  /** The open file, for the bar's labels. */
  readonly path: string;
  /** What is on disk — searched whenever there is no live buffer to search. */
  readonly contents: string;
  /** The editable view's editor, or null while the file is only being read. */
  readonly editor: Editor<"file"> | null;
  /**
   * Buffer-change subscription. Without one the buffer is read once, when the
   * bar opens — matches then follow the file rather than the typing.
   */
  readonly subscribe?: (listener: () => void) => () => void;
  /** Resolves the element that scrolls, for bringing a match into view. */
  readonly getScroller: () => HTMLElement | null;
}

export interface FindInFile {
  /** The bar, when it is open. Render it over the code. */
  readonly bar: React.ReactNode;
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

export function useFindInFile({
  path,
  contents,
  editor,
  subscribe,
  getScroller,
}: FindInFileOptions): FindInFile {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<FindOptions>(DEFAULT_FIND_OPTIONS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusKey, setFocusKey] = useState(0);
  const [anchor, setAnchor] = useState<FindAnchor | null>(null);
  const [reveal, setReveal] = useState<RevealTarget | null>(null);
  /** The live buffer while one is being typed into; null while reading. */
  const [buffered, setBuffered] = useState<string | null>(null);

  const container = useRef<HTMLElement | null>(null);
  const revealKey = useRef(0);

  // A file swapped underneath takes its search with it: the matches, the count
  // and the highlight all belonged to the file that is gone.
  useEffect(() => {
    setOpen(false);
    setActiveIndex(0);
    setReveal(null);
  }, [path]);

  // An editor owns the text the moment it is attached, so it is what gets
  // searched — the file on disk is a version behind from the first keystroke.
  // The subscription is what keeps it current; a match that has just been typed
  // should be counted. Only while the bar is open: re-reading the buffer
  // re-renders the view, and nothing is looking at the count otherwise.
  useEffect(() => {
    if (!open || editor === null) {
      setBuffered(null);
      return;
    }
    // An editor that has been built but not yet attached to the rendered file
    // answers with an empty document; the file is what to search until it has.
    const read = () => {
      const buffer = editor.getText();
      setBuffered(buffer === "" ? null : buffer);
    };
    read();
    return subscribe?.(read);
  }, [open, editor, subscribe]);

  const text = buffered ?? contents;
  const matches = useMemo(
    () => (open ? findMatches(text, query, options) : []),
    [open, text, query, options]
  );

  // Where the caret is, or failing that where the reader is looking. Read at
  // the moment ⌘F is pressed, and kept: re-reading it as the view scrolls to
  // each match would walk the search down the file on its own.
  const anchorNow = useCallback((): FindAnchor | null => {
    const selection = editor?.getViewState().selections?.at(-1);
    if (selection !== undefined) {
      return {
        line: selection.start.line + 1,
        character: selection.start.character,
      };
    }
    const scroller = getScroller();
    return scroller === null ? null : topVisibleLine(scroller);
  }, [editor, getScroller]);

  // A new query starts at the first match in front of the reader, not at the
  // top of the file.
  useEffect(() => {
    setActiveIndex(indexFrom(matches, anchor));
  }, [matches, anchor]);

  useEffect(() => {
    if (!open || matches.length === 0) return;
    const match = matches[Math.min(activeIndex, matches.length - 1)];
    revealKey.current += 1;
    setReveal({ path, line: match.line, key: revealKey.current });
  }, [open, matches, activeIndex, path]);

  useRevealLine(
    getScroller,
    open ? reveal : null,
    text.split("\n").length,
    path,
    // The match is already highlighted; flashing its line on every step would
    // be a second answer to a question nobody asked twice.
    false
  );

  // Painting is driven from two places — a fresh match list, and the view
  // re-rendering under it as the virtualiser swaps lines in — so both go
  // through here, and the refs keep `onPostRender` stable across renders.
  const state = useRef({ open, matches, activeIndex });
  state.current = { open, matches, activeIndex };

  const paint = useCallback(() => {
    const node = container.current;
    if (node === null) return;
    const now = state.current;
    if (!now.open) clearFindMarks();
    else paintFindMatches(node, now.matches, now.activeIndex);
  }, []);

  useEffect(paint, [paint, open, matches, activeIndex]);
  useEffect(() => clearFindMarks, []);

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

  // What is highlighted in the code, however this view is showing it: the
  // editor's own selection when it has one, the shadow-root selection when the
  // file is only being read. Also what ⌘⇧F picks up on its way to the grep.
  const selectedText = useCallback((): string => {
    const selection = editor?.getViewState().selections?.at(-1);
    if (selection !== undefined) {
      const covered = sliceRange(
        editor?.getText() ?? "",
        selection.start,
        selection.end
      );
      if (covered !== "") return covered;
    }
    const scroller = getScroller();
    return scroller === null ? "" : selectedTextInCode(scroller);
  }, [editor, getScroller]);

  useEffect(() => registerCodeSelection(selectedText), [selectedText]);

  const step = useCallback((direction: FindDirection) => {
    setActiveIndex((current) =>
      stepIndex(state.current.matches.length, current, direction)
    );
  }, []);

  const openBar = useCallback(() => {
    const seed = seedFromSelection(selectedText());
    if (seed !== "") setQuery(seed);
    setAnchor(anchorNow());
    setOpen(true);
    setFocusKey((key) => key + 1);
  }, [anchorNow, selectedText]);

  const closeBar = useCallback(() => {
    setOpen(false);
    clearFindMarks();
    // Hand the caret back to what was being edited, so typing carries on where
    // it left off rather than in a box that is no longer there.
    editor?.focus();
  }, [editor]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      // A dialog is over the file, not part of it: ⌘F belongs to whatever is
      // on top, and opening a find bar behind an open command palette would
      // search a file nobody can see.
      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"]') !== null
      ) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "f" && !event.shiftKey) {
        // Capture, prevent, stop: the library's own panel listens on the code
        // element below, and this is what keeps ⌘F one bar in both modes.
        event.preventDefault();
        event.stopPropagation();
        openBar();
        return;
      }
      // ⌘G / ⌘⇧G — find again, only once there is a search to repeat.
      if (key === "g" && state.current.open) {
        event.preventDefault();
        event.stopPropagation();
        step(event.shiftKey ? "previous" : "next");
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [openBar, step]);

  const bar = open ? (
    <FindBar
      path={path}
      query={query}
      onQueryChange={setQuery}
      options={options}
      onOptionsChange={setOptions}
      status={findStatus(query, matches.length, activeIndex)}
      hasMatches={matches.length > 0}
      onStep={step}
      onClose={closeBar}
      focusKey={focusKey}
    />
  ) : null;

  return {
    bar,
    viewOptions: { unsafeCSS: FIND_CSS, onPostRender },
  };
}
