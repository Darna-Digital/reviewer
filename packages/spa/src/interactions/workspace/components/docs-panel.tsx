/**
 * The docs tab: a list of a project's documents beside a markdown editor.
 *
 * The editor is a plain textarea. A doc here is a plan or a spec written
 * alongside the issues, and byconvo already renders markdown elsewhere — what
 * this needs is to be fast to open and impossible to lose work in, which is why
 * it saves on a debounce and on close rather than behind a button.
 */
import { IconFilePlus, IconSearch, IconTrash } from "@tabler/icons-react"
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
      <div className="flex w-64 shrink-0 flex-col border-r">
        <div className="flex h-10 shrink-0 items-center gap-1.5 border-b px-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search docs"
              placeholder="Search docs"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-7 rounded-md pl-8"
            />
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New doc"
            onClick={() => create("Untitled")}
          >
            <IconFilePlus />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {isLoading && (
            <div className="m-1 h-8 animate-pulse rounded-md bg-elevate" />
          )}
          {!isLoading && docs.length === 0 && (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              {search.length > 0 ? "No docs match." : "No docs yet."}
            </p>
          )}
          {docs.map((doc) => (
            <div
              key={doc.id}
              className={cn(
                "group relative flex h-8 items-center gap-1 rounded-md px-2",
                openId === doc.id ? "bg-elevate-strong" : "hover:bg-elevate"
              )}
            >
              <button
                type="button"
                onClick={() => setOpenId(doc.id)}
                className="min-w-0 flex-1 truncate text-left text-[13px]"
              >
                {doc.title}
              </button>
              <span className="shrink-0 text-[11px] text-muted-foreground opacity-100 transition-opacity group-hover:opacity-0">
                {timeAgo(doc.updatedAt)}
              </span>
              <button
                type="button"
                aria-label={`Delete ${doc.title}`}
                onClick={() => {
                  if (openId === doc.id) setOpenId(null)
                  remove(doc.id)
                }}
                className="absolute right-2 rounded p-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
              >
                <IconTrash className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {editor.state.status === "idle" && (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
            <div className="font-medium">No doc open</div>
            <div className="text-muted-foreground">
              Pick one from the list, or start a new one.
            </div>
          </div>
        )}
        {editor.state.status === "loading" && (
          <div className="p-6">
            <div className="h-6 w-1/3 animate-pulse rounded bg-elevate" />
          </div>
        )}
        {editor.state.status === "error" && (
          <div className="flex h-full items-center justify-center text-sm text-destructive">
            {editor.state.reason}
          </div>
        )}
        {editor.state.status === "ready" && (
          <>
            <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
              <span className="truncate text-[13px] font-medium">
                {editor.state.doc.title}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {editor.saving ? "Saving…" : "Saved"}
              </span>
            </header>
            <textarea
              value={editor.content}
              aria-label="Doc content"
              spellCheck
              onChange={(event) => editor.edit(event.target.value)}
              className="min-h-0 flex-1 resize-none bg-transparent p-6 font-mono text-sm leading-relaxed outline-none"
            />
          </>
        )}
      </div>
    </div>
  )
}
