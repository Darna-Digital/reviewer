import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import {
  IconArrowLeft,
  IconChevronDown,
  IconFolder,
  IconFolderOpen,
  IconGitBranch,
  IconSearch,
} from "@tabler/icons-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { api, fetchClient } from "@/lib/api/client"
import { Button } from "@/components/ui/button"
import { LoadingCursor } from "@/components/ui/loading-cursor"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { isDesktop, openDesktopDirectory } from "@/lib/desktop"
import { repoAvatar } from "@/lib/repo-avatar"
import { cn } from "@/lib/utils"
import type { RepoInfo } from "@byconvo/core/repo"
import type { WorkspaceInfo } from "@byconvo/core/workspace"

interface RepoPickerProps {
  repo: RepoInfo | null
  workspace: WorkspaceInfo | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Called after a repository is opened, instead of the default jump to the
   * commit view. The workspace pages pass this so switching repo keeps you on
   * the current page (now scoped to the newly-opened repo).
   */
  onChosen?: () => void
}

function Avatar({
  name,
  className = "size-5 text-[10px]",
}: {
  name: string
  className?: string
}) {
  const a = repoAvatar(name)
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-sm font-semibold text-white ${className}`}
      style={{ backgroundColor: a.color }}
    >
      {a.initials}
    </span>
  )
}

const rowClass =
  "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:bg-muted"

/** The repo chip in the top bar; opening it reveals a recents + folder browser
 * dropdown (a Popover, so the folder browser's controls don't auto-close it). */
export function RepoPicker({
  repo,
  workspace,
  open,
  onOpenChange,
  onChosen,
}: RepoPickerProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [path, setPath] = useState<string | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const [query, setQuery] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const browse = api.useQuery(
    "get",
    "/api/fs/browse",
    { params: { query: path === null ? {} : { path } } },
    { enabled: open && browsing }
  )

  useEffect(() => {
    if (!open) {
      setQuery("")
      setBrowsing(false)
      setPath(null)
      return
    }
    const id = requestAnimationFrame(() => searchRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const choose = async (target: string) => {
    const { data, error } = await fetchClient.POST("/api/workspace", {
      body: { path: target },
    })
    if (error) {
      toast.error(
        (error as { message?: string; reason?: string }).message ??
          (error as { reason?: string }).reason ??
          "could not open repository"
      )
      return
    }
    if (data !== undefined) {
      queryClient.setQueryData(["get", "/api/workspace"], data)
    }
    await queryClient.invalidateQueries()
    onOpenChange(false)
    // Workspace pages stay put (now scoped to the new repo); the git-review
    // shell defaults to jumping into the commit view.
    if (onChosen !== undefined) onChosen()
    else void navigate({ to: "/commit", search: {} })
  }

  const chooseDirectory = async () => {
    const selected = await openDesktopDirectory()
    if (selected !== null) {
      await choose(selected)
    }
  }

  const recents = workspace?.recents ?? []
  const filteredRecents = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return recents
    return recents.filter((recent) => {
      const name = recent.split("/").at(-1) ?? recent
      return name.toLowerCase().includes(q) || recent.toLowerCase().includes(q)
    })
  }, [query, recents])

  const data = browse.data
  const entries = data?.entries ?? []

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="max-w-56 gap-2 rounded-full px-3.5 py-1.5"
          />
        }
      >
        {repo !== null && <Avatar name={repo.name} />}
        {repo === null && (
          <IconFolder className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{repo?.name ?? "Choose project"}</span>
        <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-0 p-1">
        {!browsing && (
          <>
            <div className="-mx-1 flex items-center gap-2 border-b px-2.5 py-2">
              <IconSearch className="size-4 shrink-0 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowDown") return
                  e.preventDefault()
                  const panel = e.currentTarget.closest(
                    '[data-slot="popover-content"]'
                  )
                  if (!(panel instanceof HTMLElement)) return
                  panel
                    .querySelector<HTMLElement>("button[type='button']")
                    ?.focus()
                }}
                placeholder="Search projects"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            <ScrollArea className="max-h-72" viewportClassName="scroll-fade">
              {filteredRecents.map((recent) => {
                const name = recent.split("/").at(-1) ?? recent
                return (
                  <button
                    key={recent}
                    type="button"
                    className={rowClass}
                    onClick={() => void choose(recent)}
                  >
                    <IconFolder className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{name}</span>
                  </button>
                )
              })}
              {recents.length > 0 && filteredRecents.length === 0 && (
                <div className="px-2.5 py-3 text-sm text-muted-foreground">
                  No matching projects
                </div>
              )}
            </ScrollArea>

            <div className="mx-1 my-1 h-px bg-border" />

            {isDesktop && (
              <button
                type="button"
                className={rowClass}
                onClick={() => void chooseDirectory()}
              >
                <IconFolderOpen className="size-4 shrink-0 text-muted-foreground" />
                <span>Use an existing folder</span>
              </button>
            )}
            <button
              type="button"
              className={rowClass}
              onClick={() => {
                setBrowsing(true)
                setPath(null)
              }}
            >
              <IconFolder className="size-4 shrink-0 text-muted-foreground" />
              <span>Browse folders</span>
            </button>
          </>
        )}

        {browsing && (
          <>
            <div className="flex items-center gap-1 px-1 pb-1">
              <button
                type="button"
                className={cn(rowClass, "w-auto shrink-0 px-2")}
                onClick={() => {
                  setBrowsing(false)
                  setPath(null)
                }}
                aria-label="Back to projects"
              >
                <IconArrowLeft className="size-4 text-muted-foreground" />
              </button>
              <div className="min-w-0 flex-1 truncate px-1.5 text-xs text-muted-foreground">
                {data?.path ?? "Browse…"}
              </div>
            </div>

            <ScrollArea className="max-h-72" viewportClassName="scroll-fade">
              {browse.isPending && (
                <div className="px-2.5 py-3">
                  <LoadingCursor label="Loading folders…" />
                </div>
              )}
              {browse.error && (
                <div className="px-2.5 py-3 text-sm text-destructive">
                  Could not read this folder.
                </div>
              )}
              {data?.parent != null && (
                <button
                  type="button"
                  className={rowClass}
                  onClick={() => setPath(data.parent)}
                >
                  <IconArrowLeft className="size-4 shrink-0 text-muted-foreground" />
                  ..
                </button>
              )}
              {!browse.isPending &&
                !browse.error &&
                data !== undefined &&
                data.parent == null &&
                entries.length === 0 && (
                  <div className="px-2.5 py-3 text-sm text-muted-foreground">
                    No folders found.
                  </div>
                )}
              {entries.map((entry) => (
                <div key={entry.path} className={cn(rowClass, "pr-1.5")}>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => setPath(entry.path)}
                  >
                    {entry.isGitRepo ? (
                      <IconGitBranch className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <IconFolder className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{entry.name}</span>
                  </button>
                  {entry.isGitRepo && (
                    <button
                      type="button"
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => void choose(entry.path)}
                    >
                      Open
                    </button>
                  )}
                </div>
              ))}
            </ScrollArea>

            {data !== undefined && data.isGitRepo && (
              <>
                <div className="mx-1 my-1 h-px bg-border" />
                <button
                  type="button"
                  className={cn(rowClass, "font-medium")}
                  onClick={() => void choose(data.path)}
                >
                  <IconGitBranch className="size-4 shrink-0 text-muted-foreground" />
                  Open this repository
                </button>
              </>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
