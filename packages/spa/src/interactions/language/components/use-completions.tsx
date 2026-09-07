/**
 * Completions as you type.
 *
 * The editor is the source of truth for both halves of the question: its
 * `onChange` says the buffer moved, and its selection says where the caret is.
 * So the flow is buffer + caret → prefix → request → list, debounced so a burst
 * of keystrokes costs one round trip.
 *
 * The debounce and the round trip are also the whole difficulty. The user does
 * not stop typing while a list is being fetched, and a list is only ever an
 * answer about the caret that asked for it — so nothing here is expressed
 * against that caret once it has moved. A list is anchored to the *word* being
 * typed rather than to a column, and it is re-narrowed against the live prefix
 * on every keystroke: the rows track the typing instead of lagging a round trip
 * behind it, and accepting one replaces the word that is there now, not the
 * shorter one that was there when the provider was asked.
 *
 * Accepting an item applies two things: the replacement of the typed word, and
 * — for a symbol that is not in scope — the import edits the provider resolves.
 * Both go in one batch, so they land against the same buffer (an import
 * inserted first would push the caret's line down under the insertion), and a
 * single undo takes back the whole thing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor, TextEdit } from "@pierre/diffs/edit";
import type { CompletionItem, FileEdits } from "@reviewer/core/language";
import { caretRect } from "@/lib/code-root";
import { rectAnchor, type VirtualAnchor } from "../functions/anchors";
import {
  requestCompletions,
  resolveCompletion,
} from "../adapters/language.hook.adapter";
import {
  acceptedEdit,
  isEchoOfAccept,
  moveSelection,
  needsResolve,
  prefixOf,
  shouldRequest,
  stillApplies,
  visibleItems,
  wordStart,
  type CaretPosition,
  type OpenList,
} from "../functions/completion-state";
import { CompletionPopup } from "./completion-popup";

/** How long typing settles before the list is asked for. */
const DEBOUNCE_MS = 120;

/** Keys that move the caret without changing the buffer, so the list retires. */
const CARET_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/** Where the caret is, and the line it is on. */
interface Caret extends CaretPosition {
  readonly lineText: string;
  readonly contents: string;
}

export interface CompletionsOptions {
  /** Null in a read-only view; the hook is disabled then. */
  readonly editor: Editor<"file"> | null;
  /** Buffer-change subscription owned by the editing hook. */
  readonly subscribe?: (listener: () => void) => () => void;
  /**
   * Whether the caret is in the code. The list owns Enter, Tab and the arrows
   * while it is open, and it must not take them from the find bar or a comment
   * composer that has since been focused.
   */
  readonly isFocused?: () => boolean;
  /** Repository-relative path of the open file. */
  readonly path: string;
  readonly enabled?: boolean;
  /** Resolves the element the rendered code lives under. */
  readonly getContainer: () => ParentNode | null;
}

export interface Completions {
  readonly popup: React.ReactNode;
}

export function useCompletions({
  editor,
  subscribe,
  isFocused,
  path,
  enabled = true,
  getContainer,
}: CompletionsOptions): Completions {
  const [list, setList] = useState<OpenList | null>(null);
  /** The caret the rows are narrowed against — re-read on every keystroke. */
  const [caret, setCaret] = useState<Caret | null>(null);
  const [selected, setSelected] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Rising counter so a slow response for an old caret is ignored. */
  const generation = useRef(0);
  /** Caret left behind by the last accept, so its own echo stays closed. */
  const accepted = useRef<CaretPosition | null>(null);

  const close = useCallback(() => {
    generation.current += 1;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setList(null);
    setCaret(null);
    setSelected(0);
  }, []);

  /** The caret, or null when there is no single collapsed one. */
  const caretOf = useCallback((): Caret | null => {
    if (editor === null) return null;
    const state = editor.getViewState();
    const selection = state.selections?.[0];
    if (selection === undefined) return null;
    // A range selection is a different gesture; the bar handles that one.
    if (
      selection.start.line !== selection.end.line ||
      selection.start.character !== selection.end.character
    ) {
      return null;
    }
    // `EditorViewState` is only selections + view; the document is read from
    // the editor itself.
    const contents = editor.getText();
    const lines = contents.split("\n");
    return {
      line: selection.start.line,
      character: selection.start.character,
      lineText: lines[selection.start.line] ?? "",
      contents,
    };
  }, [editor]);

  const request = useCallback(() => {
    if (!enabled) return;
    const asked = caretOf();
    if (asked === null || !shouldRequest(asked)) {
      close();
      return;
    }
    if (isEchoOfAccept(asked, accepted.current)) {
      accepted.current = null;
      close();
      return;
    }
    accepted.current = null;
    const ticket = ++generation.current;
    const anchor = { line: asked.line, startCharacter: wordStart(asked) };
    void requestCompletions(
      path,
      { line: asked.line, character: asked.character },
      prefixOf(asked),
      asked.contents
    )
      .then((result) => {
        if (ticket !== generation.current) return;
        // The caret may have moved on during the round trip. A list still
        // belongs to the word it was asked about; anywhere else it is an answer
        // to a question nobody is asking any more.
        const now = caretOf();
        const open: OpenList = { items: result.items, ...anchor };
        if (
          result.items.length === 0 ||
          now === null ||
          !stillApplies(open, now)
        ) {
          setList(null);
          setCaret(null);
          return;
        }
        setList(open);
        setCaret(now);
        setSelected(0);
      })
      .catch(() => {
        if (ticket === generation.current) {
          setList(null);
          setCaret(null);
        }
      });
  }, [caretOf, close, enabled, path]);

  // A list outlives its own usefulness the moment completions are switched off
  // under it — Vim leaving insert mode, or the edit session closing. Neither
  // sends a keystroke this hook would see, so the flag itself has to close it.
  useEffect(() => {
    if (!enabled) close();
  }, [close, enabled]);

  // Re-measured on every reposition, so the list rides along with the caret
  // instead of being stranded where it first appeared.
  const anchor = useCallback((): VirtualAnchor | null => {
    const container = getContainer();
    const rect = container === null ? null : caretRect(container);
    return rect === null ? null : rectAnchor(rect);
  }, [getContainer]);

  // Every buffer change moves the rows *now*, from the list already in hand,
  // and asks for a fresh one behind that. Waiting for the round trip to narrow
  // what is on screen is what makes a popup feel a keystroke behind the typing.
  useEffect(() => {
    if (!enabled || subscribe === undefined) return;
    const unsubscribe = subscribe(() => {
      // `onChange` runs before the editor moves its own selection, so the
      // caret behind a keystroke is only readable once the change has been
      // seen all the way through.
      queueMicrotask(() => setCaret(caretOf()));
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = setTimeout(request, DEBOUNCE_MS);
    });
    return () => {
      unsubscribe();
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, [caretOf, enabled, request, subscribe]);

  // What the popup actually shows: the provider's answer, narrowed to the word
  // as it stands. An open list the caret has left, or one nothing matches any
  // more, is not shown at all — and is not accepted by Enter either.
  const items = useMemo<ReadonlyArray<CompletionItem>>(() => {
    if (list === null || caret === null) return [];
    if (!stillApplies(list, caret)) return [];
    return visibleItems(list, caret);
  }, [list, caret]);

  const open = items.length > 0;

  const accept = useCallback(
    (index: number) => {
      const item = items[index];
      if (item === undefined || editor === null) return;
      // Read the caret again rather than trusting the one the list was drawn
      // for: a keystroke between the render and the Enter would otherwise make
      // the replacement eat the wrong span.
      const at = caretOf();
      if (at === null) {
        close();
        return;
      }
      close();

      /**
       * Put the word in, together with whatever has to land beside it.
       *
       * The replaced span is worked out here rather than when Enter was pressed
       * — resolving an import is a round trip, and the caret can have moved on
       * by the time it comes back. One `applyEdits` for the pair: the import
       * would otherwise push the caret's line down under an insertion aimed at
       * where that line used to be, and two calls would be two undos.
       */
      const commit = (imports: ReadonlyArray<TextEdit>) => {
        const now = caretOf() ?? at;
        const replacement = acceptedEdit(item, now.line, now);
        editor.applyEdits(
          [
            ...imports,
            {
              range: {
                start: {
                  line: replacement.line,
                  character: replacement.startCharacter,
                },
                end: {
                  line: replacement.line,
                  character: replacement.endCharacter,
                },
              },
              newText: replacement.newText,
            },
          ],
          true
        );
        // The caret after the edit is what the next request compares against to
        // recognise its own echo, and imports landing above it shift the line —
        // so it is read back rather than predicted.
        const after = editor.getViewState().selections?.[0];
        accepted.current =
          after === undefined
            ? null
            : { line: after.start.line, character: after.start.character };
      };

      if (!needsResolve(item)) {
        commit([]);
        return;
      }

      // The import edits are offsets into the buffer as the provider saw it, so
      // they only go in the batch while that is still the buffer. If the user
      // typed through the round trip the word goes in alone: a missing import
      // is a diagnostic, a misplaced one is corrupted code.
      const asked = at.contents;
      const importsFor = (edits: ReadonlyArray<FileEdits>) =>
        editor.getText() !== asked
          ? []
          : edits
              .filter((file) => file.path === path)
              .flatMap((file) => file.edits.map((edit) => ({ ...edit })));

      void resolveCompletion(
        path,
        { line: at.line, character: at.character },
        { label: item.label, source: item.source, data: item.data },
        asked
      )
        .then((resolution) => commit(importsFor(resolution.additionalEdits)))
        .catch(() => commit([]));
    },
    [caretOf, close, editor, items, path]
  );

  // The list owns the arrow keys, Enter and Escape only while it is open — and
  // only while the caret it belongs to is the thing being typed into.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isFocused?.() === false) {
        close();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // Dismissing the list is the whole gesture; letting Escape through
        // would also collapse the selection under it.
        event.stopPropagation();
        close();
        return;
      }
      // A caret moved off the word is a caret that has left this list behind.
      // The change never reaches `onChange`, so it is caught here instead.
      if (CARET_KEYS.has(event.key)) {
        close();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setSelected((current) =>
          moveSelection(
            current,
            event.key === "ArrowDown" ? 1 : -1,
            items.length
          )
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        accept(Math.min(selected, items.length - 1));
      }
    };
    // A click anywhere puts the caret somewhere the list was not asked about.
    const onPointerDown = (event: Event) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-completion-popup]")
      )
        return;
      close();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", close, true);
    };
  }, [accept, close, isFocused, items.length, open, selected]);

  const popup = useMemo(
    () =>
      !open ? null : (
        <CompletionPopup
          anchor={anchor}
          items={items}
          selected={Math.min(selected, items.length - 1)}
          onSelect={setSelected}
          onAccept={accept}
          onClose={close}
        />
      ),
    [accept, anchor, close, items, open, selected]
  );

  return { popup };
}
