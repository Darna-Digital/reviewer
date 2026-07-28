import { type FileContents } from "@pierre/diffs"
import { Editor } from "@pierre/diffs/editor"
import { EditorProvider, File } from "@pierre/diffs/react"
import { IconX } from "@tabler/icons-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  deleteLinesEdits,
  duplicateLinesEdits,
  lineCommentToken,
  toggleLineCommentEdits,
} from "@/components/editor/editor-commands"
import { THEMES, useLangReady } from "@/components/editor/highlighter"
import {
  useRevealLine,
  type RevealTarget,
} from "@/interactions/language/components/use-reveal-line"
import { Button } from "@/components/ui/button"
import { LoadingCursor } from "@/components/ui/loading-cursor"
import { fetchClient } from "@/lib/api/client"
import { useFile } from "@/lib/queries"
import type { Theme } from "@/lib/ui-prefs"

interface CodeEditorProps {
  path: string
  theme: Theme
  onClose: () => void
  onSaved: () => void
  /** Scroll this one-based line into view and flash it, as the viewer does. */
  reveal?: RevealTarget | null
}

export function CodeEditor({
  path,
  theme,
  onClose,
  onSaved,
  reveal = null,
}: CodeEditorProps) {
  const loaded = useFile(path)
  const scroller = useRef<HTMLDivElement>(null)
  const langReady = useLangReady(path)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // The editor owns the live buffer once attached; we mirror its latest
  // contents here (via onChange) so Save can persist without re-reading the DOM.
  const valueRef = useRef("")
  const originalRef = useRef("")
  const saveRef = useRef<() => void>(() => {})
  const focusedRef = useRef(false)

  // One editor instance for the lifetime of this component. `File` attaches it
  // (editor.edit) when `contentEditable` is set and the editor is in context.
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
      },
    })
    return () => editor.cleanUp()
  }, [editor])

  // Seed our mirrors whenever the file (re)loads; `File` is re-keyed by path so
  // the editor itself reseeds on navigation.
  useEffect(() => {
    if (loaded.data !== undefined) {
      valueRef.current = loaded.data.contents
      originalRef.current = loaded.data.contents
      setDirty(false)
    }
  }, [loaded.data])

  const save = useCallback(async () => {
    if (!dirty) return
    setSaving(true)
    try {
      const { error } = await fetchClient.PUT("/api/file", {
        body: { path, contents: valueRef.current },
      })
      if (error)
        throw new Error((error as { reason?: string }).reason ?? "save failed")
      originalRef.current = valueRef.current
      setDirty(false)
      toast.success("Saved")
      onSaved()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setSaving(false)
    }
  }, [path, dirty, onSaved])
  saveRef.current = () => void save()

  // Editor commands pierre doesn't provide, driven through `applyEdits` over the
  // lines touched by the current selection(s).
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
    // Capture phase so our shortcuts win over the editor's own key handling.
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

  // The editor scrolls itself, so the scroller is this component's own root.
  useRevealLine(
    useCallback(() => scroller.current, []),
    reveal,
    loaded.data === undefined ? 0 : loaded.data.contents.split("\n").length
  )

  if (loaded.isPending || !langReady) {
    return (
      <div className="p-8">
        <LoadingCursor label={`Loading ${path}…`} />
      </div>
    )
  }
  if (loaded.error || loaded.data === undefined) {
    return (
      <div className="p-8 text-sm text-destructive">Could not open {path}</div>
    )
  }

  return (
    <div ref={scroller} className="h-full overflow-auto">
      <section className="diff-file" data-file-anchor={path}>
        <EditorProvider editor={editor}>
          {/* Remount per file so the editor reseeds from the new contents.
              disableWorkerPool: the editable view snapshots the rendered code
              when the editor attaches, so an async worker highlight that lands
              after attach never reaches it — first open would stay uncolored
              whenever the pool's AST cache misses (e.g. straight from the diff
              pane). useLangReady has already primed the main-thread
              highlighter, which colors the first paint synchronously. */}
          <File
            key={path}
            file={{ name: path, contents: loaded.data.contents }}
            contentEditable
            disableWorkerPool
            options={{
              theme: THEMES,
              themeType: theme,
              overflow: "wrap",
              stickyHeader: false,
            }}
            renderHeaderFilenameSuffix={() =>
              dirty ? (
                <span
                  className="ml-2 inline-block size-1.5 rounded-full bg-primary align-middle"
                  title="Unsaved changes"
                />
              ) : null
            }
            renderHeaderMetadata={() => (
              <div className="flex items-center gap-1">
                <Button
                  size="xs"
                  disabled={!dirty || saving}
                  onClick={() => void save()}
                >
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={onClose}
                  aria-label="Close editor"
                >
                  <IconX />
                </Button>
              </div>
            )}
          />
        </EditorProvider>
      </section>
    </div>
  )
}
