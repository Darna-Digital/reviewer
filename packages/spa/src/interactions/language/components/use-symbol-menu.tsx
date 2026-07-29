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
import { useCallback, useEffect, useMemo, useState } from "react"
import type { Editor } from "@pierre/diffs/editor"
import type { CodeActionItem, FileEdits } from "@byconvo/core/language"
import type { Rect } from "@/lib/floating-placement"
import { requestCodeActions } from "../adapters/language.hook.adapter"
import {
  identifierWithin,
  positionOfToken,
} from "../functions/language.functions"
import type { TokenSpan } from "../interfaces/language.interfaces"
import { SymbolMenu, type SymbolMenuEntry } from "./symbol-menu"

interface MenuState {
  readonly anchor: Rect
  readonly token: TokenSpan
  readonly actions: ReadonlyArray<CodeActionItem>
  readonly loading: boolean
}

export interface SymbolMenuOptions {
  readonly editor: Editor<undefined>
  readonly path: string
  readonly enabled?: boolean
  readonly getContainer: () => ParentNode | null
  /** Show the usages of a symbol, reusing the card the click path opens. */
  readonly onFindUsages: (token: TokenSpan, anchor: Rect) => void
  readonly onGoToDefinition: (token: TokenSpan, anchor: Rect) => void
  /** Apply edits that land in files other than the open one. */
  readonly onApplyForeignEdits: (edits: ReadonlyArray<FileEdits>) => void
}

export interface SymbolMenuHandle {
  readonly menu: React.ReactNode
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
  let token: HTMLElement | null = null
  for (const element of event.composedPath()) {
    if (
      token === null &&
      element instanceof HTMLElement &&
      element.hasAttribute("data-char")
    ) {
      token = element
    }
    if (element === container) return token
  }
  return container === null ? token : null
}

const lineNumberOf = (token: HTMLElement): number | null => {
  const line = token.closest("[data-line]")
  const value = line?.getAttribute("data-line")
  if (value === undefined || value === null) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : null
}

export function useSymbolMenu({
  editor,
  path,
  enabled = true,
  getContainer,
  onFindUsages,
  onGoToDefinition,
  onApplyForeignEdits,
}: SymbolMenuOptions): SymbolMenuHandle {
  const [state, setState] = useState<MenuState | null>(null)

  const close = useCallback(() => setState(null), [])

  useEffect(() => {
    if (!enabled) return

    const onContextMenu = (event: MouseEvent) => {
      const element = tokenFromEvent(event, getContainer())
      if (element === null) return
      const lineNumber = lineNumberOf(element)
      const charStart = Number.parseInt(
        element.getAttribute("data-char") ?? "",
        10
      )
      if (lineNumber === null || !Number.isFinite(charStart)) return
      const text = element.textContent ?? ""
      const token = identifierWithin({
        lineNumber,
        lineCharStart: charStart,
        lineCharEnd: charStart + text.length,
        tokenText: text,
      })
      if (token === null) return

      // The browser menu would cover ours, and there is nothing in it worth
      // keeping over a symbol.
      event.preventDefault()
      const anchor: Rect = {
        top: event.clientY,
        bottom: event.clientY,
        left: event.clientX,
      }
      // Held by identity so a slow answer for one symbol cannot land in the
      // menu of the next one right-clicked.
      const opened: MenuState = { anchor, token, actions: [], loading: true }
      setState(opened)

      const position = positionOfToken(token)
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
        )
    }

    // Listening on the window rather than on the code roots: the view mounts
    // after this effect first runs, and its roots are replaced on every
    // re-render, so anything bound to them would be bound to the wrong DOM.
    // `tokenFromEvent` is what keeps the menu to the code — everywhere else in
    // the app keeps the browser's own menu.
    window.addEventListener("contextmenu", onContextMenu, true)
    return () => window.removeEventListener("contextmenu", onContextMenu, true)
  }, [editor, enabled, getContainer, path])

  const applyAction = useCallback(
    (action: CodeActionItem) => {
      close()
      const here = action.edits.filter((file) => file.path === path)
      const elsewhere = action.edits.filter((file) => file.path !== path)
      if (here.length > 0) {
        editor.applyEdits(
          here.flatMap((file) => file.edits.map((edit) => ({ ...edit }))),
          true
        )
      }
      if (elsewhere.length > 0) onApplyForeignEdits(elsewhere)
    },
    [close, editor, onApplyForeignEdits, path]
  )

  const entries = useMemo<ReadonlyArray<SymbolMenuEntry>>(() => {
    if (state === null) return []
    const out: Array<SymbolMenuEntry> = [
      {
        id: "usages",
        label: `Find usages of ${state.token.tokenText}`,
        run: () => {
          close()
          onFindUsages(state.token, state.anchor)
        },
      },
      {
        id: "definition",
        label: "Go to definition",
        run: () => {
          close()
          onGoToDefinition(state.token, state.anchor)
        },
      },
    ]
    for (const [index, action] of state.actions.entries()) {
      out.push({
        id: `fix:${index}`,
        label: action.title,
        group: "fix",
        run: () => applyAction(action),
      })
    }
    return out
  }, [applyAction, close, onFindUsages, onGoToDefinition, state])

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
  )

  return { menu }
}
