import { type FileContents } from "@pierre/diffs"
import { Editor } from "@pierre/diffs/editor"
import { EditorProvider, File } from "@pierre/diffs/react"
import { IconX } from "@tabler/icons-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { THEMES, useLangReady } from "@/components/editor/highlighter"
import { Button } from "@/components/ui/button"
import { fetchClient } from "@/lib/api/client"
import { useFile } from "@/lib/queries"
import type { Theme } from "@/lib/ui-prefs"

interface CodeEditorProps {
  path: string
  theme: Theme
  onClose: () => void
  onSaved: () => void
}

export function CodeEditor({ path, theme, onClose, onSaved }: CodeEditorProps) {
  const loaded = useFile(path)
  const langReady = useLangReady(path)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // The editor owns the live buffer once attached; we mirror its latest
  // contents here (via onChange) so Save can persist without re-reading the DOM.
  const valueRef = useRef("")
  const originalRef = useRef("")

  // One editor instance for the lifetime of this component. `File` attaches it
  // (editor.edit) when `contentEditable` is set and the editor is in context.
  const editor = useMemo(() => new Editor<undefined>(), [])
  useEffect(() => {
    editor.setOptions({
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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault()
        void save()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [save])

  if (loaded.isPending || !langReady) {
    return (
      <div className="p-8 text-sm text-muted-foreground">Loading {path}…</div>
    )
  }
  if (loaded.error || loaded.data === undefined) {
    return (
      <div className="p-8 text-sm text-destructive">Could not open {path}</div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <section className="diff-file" data-file-anchor={path}>
        <EditorProvider editor={editor}>
          {/* Remount per file so the editor reseeds from the new contents. */}
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
