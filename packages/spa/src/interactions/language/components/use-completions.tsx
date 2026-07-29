/**
 * Completions as you type.
 *
 * The editor is the source of truth for both halves of the question: its
 * `onChange` says the buffer moved, and its selection says where the caret is.
 * So the flow is buffer + caret → prefix → request → list, debounced so a burst
 * of keystrokes costs one round trip.
 *
 * Accepting an item applies two things: the replacement of the typed prefix,
 * and — for a symbol that is not in scope — the import edits the provider
 * resolves. Both go through the editor, so a single undo takes back the whole
 * thing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Editor } from "@pierre/diffs/editor"
import type { CompletionItem } from "@byconvo/core/language"
import { caretRect } from "@/lib/code-root"
import { rectAnchor, type VirtualAnchor } from "../functions/anchors"
import {
  requestCompletions,
  resolveCompletion,
} from "../adapters/language.hook.adapter"
import {
  acceptedEdit,
  caretAfter,
  isEchoOfAccept,
  moveSelection,
  needsResolve,
  prefixOf,
  shouldRequest,
  type CaretPosition,
} from "../functions/completion-state"
import { CompletionPopup } from "./completion-popup"

/** How long typing settles before the list is asked for. */
const DEBOUNCE_MS = 120

interface OpenList {
  readonly items: ReadonlyArray<CompletionItem>
  /** Caret the list was computed for, so a stale response can be discarded. */
  readonly line: number
  readonly character: number
  readonly lineText: string
}

export interface CompletionsOptions {
  /** Null in a read-only view; the hook is disabled then. */
  readonly editor: Editor<undefined> | null
  /** Buffer-change subscription owned by the editing hook. */
  readonly subscribe?: (listener: () => void) => () => void
  /** Repository-relative path of the open file. */
  readonly path: string
  readonly enabled?: boolean
  /** Resolves the element the rendered code lives under. */
  readonly getContainer: () => ParentNode | null
}

export interface Completions {
  readonly popup: React.ReactNode
}

export function useCompletions({
  editor,
  subscribe,
  path,
  enabled = true,
  getContainer,
}: CompletionsOptions): Completions {
  const [open, setOpen] = useState<OpenList | null>(null)
  const [selected, setSelected] = useState(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Rising counter so a slow response for an old caret is ignored. */
  const generation = useRef(0)
  /** Caret left behind by the last accept, so its own echo stays closed. */
  const accepted = useRef<CaretPosition | null>(null)

  const close = useCallback(() => {
    generation.current += 1
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setOpen(null)
    setSelected(0)
  }, [])

  /** The caret, or null when there is no single collapsed one. */
  const caretOf = useCallback(() => {
    if (editor === null) return null
    const state = editor.getState()
    const selection = state.selections?.[0]
    if (selection === undefined) return null
    // A range selection is a different gesture; the bar handles that one.
    if (
      selection.start.line !== selection.end.line ||
      selection.start.character !== selection.end.character
    ) {
      return null
    }
    const lines = state.file.contents.split("\n")
    const lineText = lines[selection.start.line] ?? ""
    return {
      line: selection.start.line,
      character: selection.start.character,
      lineText,
      contents: state.file.contents,
    }
  }, [editor])

  const request = useCallback(() => {
    if (!enabled) return
    const caret = caretOf()
    if (caret === null || !shouldRequest(caret)) {
      close()
      return
    }
    if (isEchoOfAccept(caret, accepted.current)) {
      accepted.current = null
      close()
      return
    }
    accepted.current = null
    const ticket = ++generation.current
    const prefix = prefixOf(caret)
    void requestCompletions(
      path,
      { line: caret.line, character: caret.character },
      prefix,
      caret.contents
    )
      .then((result) => {
        if (ticket !== generation.current) return
        if (result.items.length === 0) {
          setOpen(null)
          return
        }
        setOpen({
          items: result.items,
          line: caret.line,
          character: caret.character,
          lineText: caret.lineText,
        })
        setSelected(0)
      })
      .catch(() => {
        if (ticket === generation.current) setOpen(null)
      })
  }, [caretOf, close, enabled, path])

  // Re-measured on every reposition, so the list rides along with the caret
  // instead of being stranded where it first appeared.
  const anchor = useCallback((): VirtualAnchor | null => {
    const container = getContainer()
    const rect = container === null ? null : caretRect(container)
    return rect === null ? null : rectAnchor(rect)
  }, [getContainer])

  // Re-ask whenever the buffer changes.
  useEffect(() => {
    if (!enabled || subscribe === undefined) return
    const unsubscribe = subscribe(() => {
      if (timer.current !== null) clearTimeout(timer.current)
      timer.current = setTimeout(request, DEBOUNCE_MS)
    })
    return () => {
      unsubscribe()
      if (timer.current !== null) clearTimeout(timer.current)
    }
  }, [enabled, request, subscribe])

  const accept = useCallback(
    (index: number) => {
      if (open === null || editor === null) return
      const item = open.items[index]
      if (item === undefined) return
      const caret = { lineText: open.lineText, character: open.character }
      const replacement = acceptedEdit(item, open.line, caret)
      accepted.current = caretAfter(replacement)
      close()

      const applyInsertion = () =>
        editor.applyEdits(
          [
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
        )

      if (!needsResolve(item)) {
        applyInsertion()
        return
      }

      // An import has to land before the insertion, or its own edit offsets —
      // computed against the buffer as the provider saw it — would be stale.
      void resolveCompletion(
        path,
        { line: open.line, character: open.character },
        { label: item.label, source: item.source, data: item.data },
        editor.getState().file.contents
      )
        .then((resolution) => {
          const here = resolution.additionalEdits.filter(
            (file) => file.path === path
          )
          editor.applyEdits(
            here.flatMap((file) => file.edits.map((edit) => ({ ...edit }))),
            true
          )
          applyInsertion()
        })
        .catch(() => applyInsertion())
    },
    [close, editor, open, path]
  )

  // The list owns the arrow keys, Enter and Escape only while it is open.
  useEffect(() => {
    if (open === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        close()
        return
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        setSelected((current) =>
          moveSelection(
            current,
            event.key === "ArrowDown" ? 1 : -1,
            open.items.length
          )
        )
        return
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault()
        accept(selected)
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    window.addEventListener("scroll", close, true)
    return () => {
      window.removeEventListener("keydown", onKeyDown, true)
      window.removeEventListener("scroll", close, true)
    }
  }, [accept, close, open, selected])

  const popup = useMemo(
    () =>
      open === null ? null : (
        <CompletionPopup
          anchor={anchor}
          items={open.items}
          selected={selected}
          onSelect={setSelected}
          onAccept={accept}
          onClose={close}
        />
      ),
    [accept, anchor, close, open, selected]
  )

  return { popup }
}
