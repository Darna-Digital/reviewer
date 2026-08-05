/**
 * Right-click on a symbol.
 *
 * The menu is the home for everything that needs a symbol but not a selection:
 * find usages, go to definition, and the quick fixes at that spot — which is
 * where an unresolved import gets resolved.
 *
 * Fixes are fetched when the menu opens rather than listed optimistically, so
 * the menu only ever offers something that will actually apply.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Editor } from "@pierre/diffs/editor";
import type { CodeActionItem, FileEdits } from "@byconvo/core/language";
import { pointerAnchor, type VirtualAnchor } from "../functions/anchors";
import { requestCodeActions } from "../adapters/language.hook.adapter";
import {
  identifierWithin,
  positionOfToken,
} from "../functions/language.functions";
import type { TokenSpan } from "../interfaces/language.interfaces";
import { SymbolMenu, type SymbolMenuEntry } from "./symbol-menu";

interface MenuState {
  readonly anchor: VirtualAnchor;
  readonly token: TokenSpan;
  readonly actions: ReadonlyArray<CodeActionItem>;
  readonly loading: boolean;
}

export interface SymbolMenuOptions {
  /** Null in a read-only view; the hook is disabled then. */
  readonly editor: Editor<undefined> | null;
  readonly path: string;
  readonly enabled?: boolean;
  readonly getContainer: () => ParentNode | null;
  /**
   * The menu is opening. The pointer has been resting on the token to get here,
   * so the hover card is usually open too — and it is a bigger surface, drawn
   * over the same spot, which would cover the menu it is competing with.
   */
  readonly onOpen: () => void;
  /** Show the usages of a symbol, reusing the card the click path opens. */
  readonly onFindUsages: (token: TokenSpan, anchor: VirtualAnchor) => void;
  readonly onGoToDefinition: (token: TokenSpan, anchor: VirtualAnchor) => void;
  /** Apply edits that land in files other than the open one. */
  readonly onApplyForeignEdits?: (edits: ReadonlyArray<FileEdits>) => void;
}

export interface SymbolMenuHandle {
  readonly menu: React.ReactNode;
}

/**
 * The token element a pointer event landed on, or null when the event did not
 * land on code belonging to `container`.
 *
 * The composed path is the one view of the event that crosses shadow
 * boundaries, and it holds both halves of the answer: the token itself, and the
 * ancestors that say whether the token is ours.
 */
const tokenFromEvent = (
  event: MouseEvent,
  container: ParentNode | null
): HTMLElement | null => {
  let token: HTMLElement | null = null;
  for (const element of event.composedPath()) {
    if (
      token === null &&
      element instanceof HTMLElement &&
      element.hasAttribute("data-char")
    ) {
      token = element;
    }
    if (element === container) return token;
  }
  return container === null ? token : null;
};

const lineNumberOf = (token: HTMLElement): number | null => {
  const line = token.closest("[data-line]");
  const value = line?.getAttribute("data-line");
  if (value === undefined || value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

export function useSymbolMenu({
  editor,
  path,
  enabled = true,
  getContainer,
  onOpen,
  onFindUsages,
  onGoToDefinition,
  onApplyForeignEdits,
}: SymbolMenuOptions): SymbolMenuHandle {
  const [state, setState] = useState<MenuState | null>(null);

  const close = useCallback(() => setState(null), []);

  useEffect(() => {
    if (!enabled || editor === null) return;

    const onContextMenu = (event: MouseEvent) => {
      const element = tokenFromEvent(event, getContainer());
      if (element === null) return;
      const lineNumber = lineNumberOf(element);
      const charStart = Number.parseInt(
        element.getAttribute("data-char") ?? "",
        10
      );
      if (lineNumber === null || !Number.isFinite(charStart)) return;
      const text = element.textContent ?? "";
      const token = identifierWithin({
        lineNumber,
        lineCharStart: charStart,
        lineCharEnd: charStart + text.length,
        tokenText: text,
      });
      if (token === null) return;

      // The browser menu would cover ours, and there is nothing in it worth
      // keeping over a symbol.
      event.preventDefault();
      onOpen();
      const anchor = pointerAnchor(event.clientX, event.clientY);
      // Held by identity so a slow answer for one symbol cannot land in the
      // menu of the next one right-clicked.
      const opened: MenuState = { anchor, token, actions: [], loading: true };
      setState(opened);

      const position = positionOfToken(token);
      void requestCodeActions(
        path,
        { start: position, end: position },
        editor.getState().file.contents
      )
        .then((result) =>
          setState((current) =>
            current === opened
              ? { ...current, actions: result.actions, loading: false }
              : current
          )
        )
        .catch(() =>
          setState((current) =>
            current === opened ? { ...current, loading: false } : current
          )
        );
    };

    // Listening on the window rather than on the code roots: the view mounts
    // after this effect first runs, and its roots are replaced on every
    // re-render, so anything bound to them would be bound to the wrong DOM.
    // `tokenFromEvent` is what keeps the menu to the code — everywhere else in
    // the app keeps the browser's own menu.
    window.addEventListener("contextmenu", onContextMenu, true);
    return () => window.removeEventListener("contextmenu", onContextMenu, true);
  }, [editor, enabled, getContainer, onOpen, path]);

  const applyAction = useCallback(
    (action: CodeActionItem) => {
      close();
      if (editor === null) return;
      const here = action.edits.filter((file) => file.path === path);
      const elsewhere = action.edits.filter((file) => file.path !== path);
      if (here.length > 0) {
        editor.applyEdits(
          here.flatMap((file) => file.edits.map((edit) => ({ ...edit }))),
          true
        );
      }
      if (elsewhere.length > 0) onApplyForeignEdits?.(elsewhere);
    },
    [close, editor, onApplyForeignEdits, path]
  );

  const entries = useMemo<ReadonlyArray<SymbolMenuEntry>>(() => {
    if (state === null) return [];
    const out: Array<SymbolMenuEntry> = [
      {
        id: "usages",
        label: `Find usages of ${state.token.tokenText}`,
        run: () => {
          close();
          onFindUsages(state.token, state.anchor);
        },
      },
      {
        id: "definition",
        label: "Go to definition",
        run: () => {
          close();
          onGoToDefinition(state.token, state.anchor);
        },
      },
    ];
    for (const [index, action] of state.actions.entries()) {
      out.push({
        id: `fix:${index}`,
        label: action.title,
        group: "fix",
        run: () => applyAction(action),
      });
    }
    return out;
  }, [applyAction, close, onFindUsages, onGoToDefinition, state]);

  const menu = useMemo(
    () =>
      state === null ? null : (
        <SymbolMenu
          anchor={state.anchor}
          entries={entries}
          loading={state.loading}
          onClose={close}
        />
      ),
    [close, entries, state]
  );

  return { menu };
}
