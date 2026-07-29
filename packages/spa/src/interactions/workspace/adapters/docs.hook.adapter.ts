/**
 * The docs side of the workspace.
 *
 * The collection holds summaries; a body is fetched when a doc is opened and
 * saved on a debounce while it is typed in. Saving writes the title back into
 * the collection too, because the server re-derives an untitled doc's name from
 * its first heading — so editing the heading has to rename the row in the list.
 */
import { useLiveQuery } from "@tanstack/react-db"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import type { Doc, DocSummary } from "@byconvo/core/docs"
import { searchDocs, sortDocs } from "@byconvo/core/docs"
import {
  docsCollection,
  fetchDoc,
  saveDocContent,
} from "@/lib/central/collections"

/** Long enough that a sentence is one write, short enough to feel saved. */
const SAVE_DEBOUNCE_MS = 700

export function useWorkspaceDocs(projectId: string) {
  const collection = docsCollection(projectId)
  const { data, isLoading } = useLiveQuery(
    (q) => q.from({ doc: collection }),
    [projectId]
  )
  const [search, setSearch] = useState("")

  const summaries = useMemo(
    () =>
      sortDocs(searchDocs((data ?? []) as ReadonlyArray<DocSummary>, search)),
    [data, search]
  )

  const create = useCallback(
    (title: string) => {
      const trimmed = title.trim()
      collection.insert({
        id: `pending-${crypto.randomUUID()}`,
        projectId,
        title: trimmed.length > 0 ? trimmed : "Untitled",
        updatedAt: new Date().toISOString(),
      })
    },
    [collection, projectId]
  )

  const remove = useCallback(
    (id: string) => {
      try {
        collection.delete(id)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "could not delete the doc"
        )
      }
    },
    [collection]
  )

  return { docs: summaries, isLoading, search, setSearch, create, remove }
}

export type DocEditorState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly doc: Doc }
  | { readonly status: "error"; readonly reason: string }

export function useDocEditor(projectId: string, docId: string | null) {
  const collection = docsCollection(projectId)
  const [state, setState] = useState<DocEditorState>({ status: "idle" })
  const [content, setContent] = useState("")
  const [saving, setSaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (docId === null) {
      setState({ status: "idle" })
      return
    }
    let cancelled = false
    setState({ status: "loading" })
    fetchDoc(docId).then(
      (doc) => {
        if (cancelled) return
        setState({ status: "ready", doc })
        setContent(doc.content)
      },
      (error: unknown) => {
        if (cancelled) return
        setState({
          status: "error",
          reason:
            error instanceof Error ? error.message : "could not load the doc",
        })
      }
    )
    return () => {
      cancelled = true
    }
  }, [docId])

  const flush = useCallback(
    async (id: string, next: string) => {
      setSaving(true)
      try {
        const saved = await saveDocContent(id, next)
        // The server may have re-derived the title from the body; keep the
        // list in step without a refetch.
        collection.update(id, (draft) => {
          draft.title = saved.title
          draft.updatedAt = saved.updatedAt
        })
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "could not save the doc"
        )
      } finally {
        setSaving(false)
      }
    },
    [collection]
  )

  /** The edit the debounce still owes the server, if any. */
  const pending = useRef<{ id: string; content: string } | null>(null)

  const edit = useCallback(
    (next: string) => {
      setContent(next)
      if (docId === null) return
      if (timer.current !== null) clearTimeout(timer.current)
      pending.current = { id: docId, content: next }
      timer.current = setTimeout(() => {
        pending.current = null
        void flush(docId, next)
      }, SAVE_DEBOUNCE_MS)
    },
    [docId, flush]
  )

  // Closing a doc mid-sentence must still write it: cancelling the debounce
  // without flushing would drop whatever was typed in the last 700ms.
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current)
      const owed = pending.current
      pending.current = null
      if (owed !== null) void flush(owed.id, owed.content)
    },
    [flush]
  )

  return { state, content, edit, saving }
}
