import {
  IconAdjustmentsHorizontal,
  IconClock,
  IconCode,
  IconSearch,
  IconX,
} from "@tabler/icons-react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import { ResizeHandle } from "@/components/layout/resize-handle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  applyFilters,
  buildAssignmentPrompt,
  buildAssignmentTitle,
  filtersActive as areFiltersActive,
  listComments,
  noFilters,
  type ListedComment,
} from "@/interactions/comments/functions/comment-list.functions"
import { CommentComposer } from "@/interactions/comments/components/comment-thread"
import {
  ReviewAssignBar,
  type AssignTarget,
} from "@/components/review-assign-bar"
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter"
import { buildChatAssignmentSettings } from "@/interactions/chats/functions/chat-assignment.functions"
import {
  DATE_FILTERS,
  dateFilterLabel,
  type DateFilter,
} from "@/lib/date-filter"
import { useChatModels, useChats, useComments, useRepo } from "@/lib/queries"
import { useCommentsActions } from "@/interactions/comments/adapters/comments.hook.adapter"
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"

const relativeTime = (iso: string) => {
  const diff = Date.now() - Date.parse(iso)
  const minute = 60_000
  if (diff < minute) return "just now"
  if (diff < 60 * minute) return `${Math.floor(diff / minute)}m ago`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))}h ago`
  return `${Math.floor(diff / (24 * 60 * minute))}d ago`
}

function FilterMenu({
  dateValue,
  onDateChange,
  active,
}: {
  dateValue: DateFilter
  onDateChange: (value: DateFilter) => void
  active: boolean
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="relative size-7 shrink-0"
            aria-label="Filter comments"
          >
            <IconAdjustmentsHorizontal className="size-4" />
            {active && (
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-brand-500" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconClock className="size-4" />
            <span>Time</span>
            <span className="ml-auto max-w-28 truncate text-xs text-muted-foreground">
              {dateFilterLabel(dateValue)}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            <DropdownMenuRadioGroup
              value={dateValue}
              onValueChange={(v) => onDateChange(v as DateFilter)}
            >
              {DATE_FILTERS.map((d) => (
                <DropdownMenuRadioItem key={d.value} value={d.value}>
                  {d.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
    </div>
  )
}

function CommentDetail({
  comment,
  onResolve,
  onSave,
}: {
  comment: ListedComment
  onResolve: () => void
  onSave: (body: string) => Promise<void>
}) {
  const { code } = comment
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setEditing(false)
  }, [comment.id])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
        <IconCode className="size-4 text-muted-foreground" />
        <span className="truncate text-sm font-medium">{comment.anchor}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {relativeTime(comment.createdAt)}
        </span>
        {!editing && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7" onClick={onResolve}>
          Resolve
        </Button>
      </header>
      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade p-4"
      >
        <div className="space-y-4">
          {editing ? (
            <CommentComposer
              initialBody={comment.body}
              submitLabel="Save"
              placeholder="Edit comment…"
              onCancel={() => setEditing(false)}
              onSubmit={async (body) => {
                await onSave(body)
                setEditing(false)
              }}
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
          )}

          <div className="space-y-1.5 border-t pt-3">
            <Field label="Author">{comment.author}</Field>
            <Field label="File">
              <code className="font-mono">
                {code.filePath}:{code.lineNumber}
              </code>
            </Field>
            <Field label="Side">{code.side}</Field>
            <Field label="Target">
              <code className="font-mono">{code.target}</code>
            </Field>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

export function CommentsPage() {
  const codeComments = useComments()
  const commentActions = useCommentsActions()
  const chatActions = useChatsActions()
  const chatModels = useChatModels()
  const chats = useChats()
  const repo = useRepo()
  const navigate = useNavigate()

  const prefs = useUiPrefs()
  const [sidebarWidth, setSidebarWidth] = useState(prefs.workspaceSidebarWidth)
  const [date, setDate] = useState<DateFilter>(noFilters.date)
  const [search, setSearch] = useState(noFilters.search)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assignBarDismissed, setAssignBarDismissed] = useState(false)

  const all = useMemo(
    () => listComments(codeComments.data ?? []),
    [codeComments.data]
  )

  const filters = useMemo(() => ({ date, search }), [date, search])
  const filtered = useMemo(() => applyFilters(all, filters), [all, filters])
  const filtersOn = areFiltersActive(filters)

  const selected = filtered.find((c) => c.id === selectedId) ?? null

  useEffect(() => {
    if (all.length > 0) setAssignBarDismissed(false)
  }, [all.length])

  const remove = (comment: ListedComment) => commentActions.remove(comment.code)

  const assign = async (dest: AssignTarget) => {
    if (filtered.length === 0) return
    const assigned = filtered
    const count = assigned.length
    const prompt = buildAssignmentPrompt(assigned)
    try {
      const chatId =
        dest.kind === "new"
          ? ((
              await chatActions.startWithTitle(
                buildChatAssignmentSettings(dest.agent, chatModels.data),
                repo.data?.currentBranch ?? "",
                buildAssignmentTitle(count),
                prompt
              )
            )?.id ?? null)
          : (await chatActions.send(dest.chatId, prompt)) !== null
            ? dest.chatId
            : null
      if (chatId === null) return

      // Handing them off is what resolves them — the text now lives in the chat.
      await Promise.all(assigned.map(remove))
      setSelectedId(null)
      toast.success(`Assigned ${count} comment${count === 1 ? "" : "s"}`)
      void navigate({ to: "/modes/code/chats/$chatId", params: { chatId } })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not assign comments"
      )
    }
  }

  const resolve = async (comment: ListedComment) => {
    try {
      await remove(comment)
      if (comment.id === selectedId) setSelectedId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "resolve failed")
    }
  }

  const save = async (comment: ListedComment, body: string) => {
    await commentActions.update(comment.code, body)
  }

  const openComment = (comment: ListedComment) => {
    setSelectedId(comment.id)
    const { filePath, target } = comment.code
    if (target === "worktree") {
      void navigate({ to: "/modes/code/commit", search: { path: filePath } })
      return
    }
    if (target.startsWith("commit-")) {
      void navigate({
        to: "/modes/code/browse/commit/$sha",
        params: { sha: target.slice("commit-".length) },
        search: { path: filePath },
      })
      return
    }
    if (target.includes("...")) {
      const [base, head] = target.split("...")
      if (base === undefined || head === undefined) return
      void navigate({
        to: "/modes/code/browse/range",
        search: { path: filePath, base, head },
      })
      return
    }
    if (target.startsWith("pr-")) {
      void navigate({
        to: "/modes/code/review/$pull",
        params: { pull: target.slice("pr-".length) },
        search: { path: filePath },
      })
    }
  }

  const renderRow = (comment: ListedComment) => (
    <div key={comment.id} className="group/row relative mb-0.5">
      <button
        type="button"
        onClick={() => openComment(comment)}
        className={cn(
          "flex w-full items-start gap-2 rounded-md px-2 py-1.5 pr-8 text-left hover:bg-muted/60",
          comment.id === selectedId && "bg-muted"
        )}
      >
        <IconCode className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm">{comment.body}</div>
          <div className="truncate font-mono text-xs text-muted-foreground">
            {comment.anchor}
          </div>
        </div>
      </button>
      <button
        type="button"
        aria-label="Resolve comment"
        className="absolute top-2 right-2.5 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-destructive focus-visible:opacity-100"
        onClick={() => void resolve(comment)}
      >
        <IconX className="size-3.5" />
      </button>
    </div>
  )

  return (
    <div className="flex h-full min-h-0">
      <aside
        className="flex shrink-0 flex-col border-r"
        style={{ width: sidebarWidth }}
      >
        <div className="flex items-center gap-1.5 border-b p-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search comments"
              placeholder="Search comments…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 rounded-md pr-7 pl-8"
            />
            {search.length > 0 && (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearch("")}
              >
                <IconX className="size-3.5" />
              </button>
            )}
          </div>
          <FilterMenu
            dateValue={date}
            onDateChange={setDate}
            active={filtersOn}
          />
        </div>
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="scroll-fade px-1 py-2"
        >
          {all.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No comments yet. Leave one on a diff line.
            </p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                No comments match these filters.
              </p>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setDate(noFilters.date)
                  setSearch(noFilters.search)
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            filtered.map(renderRow)
          )}
        </ScrollArea>
      </aside>
      <ResizeHandle
        orientation="col"
        value={sidebarWidth}
        min={180}
        max={() => Math.max(240, window.innerWidth - 480)}
        onResize={setSidebarWidth}
        onResizeEnd={(w) => setUiPrefs({ workspaceSidebarWidth: w })}
        label="Resize sidebar"
      />
      <section className="flex min-w-0 flex-1 flex-col">
        {selected === null ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Select a comment to see its context.
            </p>
          </div>
        ) : (
          <CommentDetail
            comment={selected}
            onResolve={() => void resolve(selected)}
            onSave={async (body) => {
              try {
                await save(selected, body)
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "save failed"
                )
                throw error
              }
            }}
          />
        )}
      </section>
      {filtered.length > 0 && !assignBarDismissed && (
        <ReviewAssignBar
          count={filtered.length}
          chats={chats.data ?? []}
          onAssign={assign}
          onDismiss={() => setAssignBarDismissed(true)}
        />
      )}
    </div>
  )
}
