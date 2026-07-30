/**
 * The docs tab: a list of a project's documents beside a markdown editor.
 *
 * The editor is a plain textarea. A doc here is a plan or a spec written
 * alongside the tasks, and byconvo already renders markdown elsewhere — what
 * this needs is to be fast to open and impossible to lose work in, which is why
 * it saves on a debounce and on close rather than behind a button.
 */
import {
  IconFilePlus,
  IconFileText,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { timeAgo } from "@/lib/relative-time"
import { cn } from "@/lib/utils"
import { useDocEditor, useWorkspaceDocs } from "../adapters/docs.hook.adapter"

export function DocsPanel({ projectId }: { projectId: string }) {
  const { docs, isLoading, search, setSearch, create, remove } =
    useWorkspaceDocs(projectId)
  const [openId, setOpenId] = useState<string | null>(null)
  const editor = useDocEditor(projectId, openId)

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-64 shrink-0 flex-col border-r border-foreground/10">
        <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-foreground/10 px-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-4 shrink-0 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search docs"
              placeholder="Search docs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New doc"
            className="text-muted-foreground"
            onClick={() => create("Untitled")}
          >
            <IconFilePlus />
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {isLoading && (
            <div className="h-9 shrink-0 animate-pulse rounded-lg bg-elevate sm:h-8" />
          )}
          {!isLoading && docs.length === 0 && (
            <p className="px-2 py-3 text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
              {search.length > 0
                ? "No docs match that search."
                : "No docs yet. Start one with the button above."}
            </p>
          )}
          {docs.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "group relative flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 sm:h-8",
                openId === doc.id ? "bg-elevate-strong" : "hover:bg-elevate"
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(doc.id)}
                className="min-w-0 flex-1 truncate text-left text-base sm:text-sm"
              >
                {doc.title}
              </button>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums group-hover:opacity-0 sm:text-xs">
                {timeAgo(doc.updatedAt)}
              </span>
              <button
                type="button"
                aria-label={`Delete ${doc.title}`}
                onClick={() => {
                  if (openId === doc.id) setOpenId(null)
                  remove(doc.id)
                }}
                className="absolute right-2 flex size-6 items-center justify-center rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
              >
                <IconTrash className="size-4 shrink-0" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {editor.state.status === "idle" && (
          <div className="flex h-full items-center justify-center p-6">
            <div className="flex flex-col items-center gap-1 rounded-3xl border border-dashed border-foreground/15 px-6 py-14 text-center">
              <IconFileText className="size-4 shrink-0 text-muted-foreground" />
              <p className="mt-2 text-base font-medium sm:text-sm">
                No doc open
              </p>
              <p className="max-w-[48ch] text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
                Docs are the plans and specs that sit beside a project's tasks.
                Pick one from the list, or start a new one.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4"
                data-icon="inline-start"
                onClick={() => create("Untitled")}
              >
                <IconFilePlus />
                New doc
              </Button>
            </div>
          </div>
        )}
        {editor.state.status === "loading" && (
          <div className="flex flex-col gap-3 p-6">
            <div className="h-6 w-1/3 animate-pulse rounded-lg bg-elevate" />
            <div className="h-4 w-2/3 animate-pulse rounded-lg bg-elevate opacity-70" />
          </div>
        )}
        {editor.state.status === "error" && (
          <div className="flex h-full items-center justify-center p-6">
            <p className="text-base text-destructive sm:text-sm">
              {editor.state.reason}
            </p>
          </div>
        )}
        {editor.state.status === "ready" && (
          <>
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-foreground/10 px-4">
              <h2 className="min-w-0 truncate text-base font-medium sm:text-sm">
                {editor.state.doc.title}
              </h2>
              <p className="ml-auto shrink-0 text-sm text-muted-foreground sm:text-xs">
                {editor.saving ? "Saving…" : "Saved"}
              </p>
            </header>
            <textarea
              value={editor.content}
              aria-label="Doc content"
              spellCheck
              onChange={(event) => editor.edit(event.target.value)}
              className="min-h-0 flex-1 resize-none bg-transparent p-6 font-mono text-base/7 outline-none sm:text-sm/7"
            />
          </>
        )}
      </div>
    </div>
  )
}
