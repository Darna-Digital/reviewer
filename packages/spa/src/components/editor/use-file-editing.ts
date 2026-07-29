/**
 * Editing a file in place.
 *
 * The file view is always editable — there is no mode to switch into — so this
 * owns everything that used to live in a separate editor component: the editor
 * instance, the dirty buffer, saving, and the keyboard commands the library
 * does not provide.
 *
 * Two constraints shape it. The editable view snapshots the rendered code when
 * the editor attaches, so an asynchronous worker highlight landing afterwards
 * never reaches it — hence `disableWorkerPool`, with `useLangReady` priming the
 * main-thread highlighter so the first paint is coloured. And the live buffer
 * is mirrored here rather than read back out of the DOM, so saving and
 * diagnostics both see exactly what the user is looking at.
 */
import { type FileContents } from "@pierre/diffs"
import { Editor } from "@pierre/diffs/editor"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  deleteLinesEdits,
  duplicateLinesEdits,
  lineCommentToken,
  toggleLineCommentEdits,
} from "@/components/editor/editor-commands"
import { fetchClient } from "@/lib/api/client"

/** How long typing settles before the buffer is handed to the analyser. */
const DIAGNOSTICS_DEBOUNCE_MS = 600

export interface FileEditing {
  readonly editor: Editor<undefined>
  /**
   * Subscribe to buffer changes. The editor keeps a single `onChange`, and
   * `setOptions` merges by key — so a second feature registering its own would
   * silently replace this one's. Everything that needs to react goes here.
   */
  readonly subscribe: (listener: () => void) => () => void
  readonly dirty: boolean
  readonly saving: boolean
  readonly save: () => void
  /**
   * The buffer to analyse: null while it matches what was loaded, so the
   * analyser reads the file from disk instead of being handed a copy of it.
   */
  readonly bufferForAnalysis: string | null
}

export function useFileEditing(
  path: string,
  loadedContents: string | undefined,
  onSaved: () => void
): FileEditing {
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [bufferForAnalysis, setBufferForAnalysis] = useState<string | null>(
    null
  )

  // The editor owns the live buffer once attached; these mirror it so saving
  // never has to read the DOM back.
  const valueRef = useRef("")
  const originalRef = useRef("")
  const saveRef = useRef<() => void>(() => {})
  const focusedRef = useRef(false)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listeners = useRef(new Set<() => void>())

  // One editor instance for the lifetime of this view. `File` attaches it
  // (editor.edit) once `contentEditable` is set and the editor is in context.
  const editor = useMemo(() => new Editor<undefined>(), [])

  useEffect(() => {
    editor.setOptions({
      onFocus: () => {
        focusedRef.current = true
      },
      onBlur: () => {
        focusedRef.current = false
      },
      onChange: (file: FileContents) => {
        valueRef.current = file.contents
        setDirty(file.contents !== originalRef.current)
        for (const listener of listeners.current) listener()
        if (debounce.current !== null) clearTimeout(debounce.current)
        debounce.current = setTimeout(() => {
          // Analysing every keystroke would rebuild the program mid-word; a
          // pause is the natural moment to re-check.
          setBufferForAnalysis(
            file.contents === originalRef.current ? null : file.contents
          )
        }, DIAGNOSTICS_DEBOUNCE_MS)
      },
    })
    return () => {
      if (debounce.current !== null) clearTimeout(debounce.current)
      editor.cleanUp()
    }
  }, [editor])

  // Reseed the mirrors whenever the file (re)loads. The view re-keys `File` by
  // path, so the editor itself reseeds on navigation.
  useEffect(() => {
    if (loadedContents === undefined) return
    valueRef.current = loadedContents
    originalRef.current = loadedContents
    setDirty(false)
    setBufferForAnalysis(null)
  }, [loadedContents])

  const save = useCallback(async () => {
    if (valueRef.current === originalRef.current) return
    setSaving(true)
    try {
      const { error } = await fetchClient.PUT("/api/file", {
        body: { path, contents: valueRef.current },
      })
      if (error)
        throw new Error((error as { reason?: string }).reason ?? "save failed")
      originalRef.current = valueRef.current
      setDirty(false)
      setBufferForAnalysis(null)
      toast.success("Saved")
      onSaved()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }, [path, onSaved])
  saveRef.current = () => void save()

  // Editor commands the library doesn't provide, applied over the lines the
  // current selection touches.
  const runCommand = useCallback(
    (kind: "toggle" | "duplicate" | "delete") => {
      const state = editor.getState()
      const selections = state.selections ?? []
      if (selections.length === 0) return
      const lines = state.file.contents.split("\n")
      const targeted = new Set<number>()
      for (const sel of selections) {
        const lo = Math.min(sel.start.line, sel.end.line)
        const hiRaw = Math.max(sel.start.line, sel.end.line)
        // A selection ending at column 0 doesn't include that trailing line.
        const hi = sel.end.character === 0 && hiRaw > lo ? hiRaw - 1 : hiRaw
        for (let n = lo; n <= hi && n < lines.length; n++) targeted.add(n)
      }
      const lineNums = [...targeted].sort((a, b) => a - b)
      if (lineNums.length === 0) return

      let edits
      if (kind === "toggle") {
        const token = lineCommentToken(path)
        if (token === null) return
        edits = toggleLineCommentEdits(lines, lineNums, token)
      } else if (kind === "duplicate") {
        edits = duplicateLinesEdits(lines, lineNums)
      } else {
        edits = deleteLinesEdits(lines, lineNums)
      }
      if (edits.length > 0) editor.applyEdits(edits, true)
    },
    [editor, path]
  )

  useEffect(() => {
    // Capture phase so these win over the editor's own key handling.
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === "s") {
        event.preventDefault()
        saveRef.current()
        return
      }
      if (!focusedRef.current) return
      if (key === "/") {
        event.preventDefault()
        event.stopPropagation()
        runCommand("toggle")
      } else if (event.shiftKey && key === "d") {
        event.preventDefault()
        event.stopPropagation()
        runCommand("duplicate")
      } else if (event.shiftKey && key === "k") {
        event.preventDefault()
        event.stopPropagation()
        runCommand("delete")
      }
    }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [runCommand])

  const subscribe = useCallback((listener: () => void) => {
    listeners.current.add(listener)
    return () => listeners.current.delete(listener)
  }, [])

  return {
    editor,
    subscribe,
    dirty,
    saving,
    save: useCallback(() => void save(), [save]),
    bufferForAnalysis,
  }
}
