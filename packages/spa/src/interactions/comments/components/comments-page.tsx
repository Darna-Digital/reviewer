import {
  IconAdjustmentsHorizontal,
  IconClock,
  IconCode,
  IconCursorText,
  IconExternalLink,
  IconFilter,
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
  KIND_FILTERS,
  applyFilters,
  buildAssignmentPrompt,
  buildAssignmentTitle,
  filtersActive as areFiltersActive,
  groupByKind,
  noFilters,
  unify,
  type CommentKind,
  type KindFilter,
  type UnifiedComment,
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
import {
  useChatModels,
  useChats,
  useComments,
  useRepo,
  useVisualComments,
} from "@/lib/queries"
import { useCommentsActions } from "@/interactions/comments/adapters/comments.hook.adapter"
import { useVisualCommentsActions } from "@/interactions/comments/adapters/visual-comments.hook.adapter"
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"

const KIND_LABELS: Record<CommentKind, string> = {
  visual: "Visual",
  code: "Code",
}

const KindIcon = ({
  kind,
  className,
}: {
  kind: CommentKind
  className?: string
}) =>
  kind === "visual" ? (
    <IconCursorText className={className} />
  ) : (
    <IconCode className={className} />
  )

const relativeTime = (iso: string) => {
  const diff = Date.now() - Date.parse(iso)
  const minute = 60_000
  if (diff < minute) return "just now"
  if (diff < 60 * minute) return `${Math.floor(diff / minute)}m ago`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))}h ago`
  return `${Math.floor(diff / (24 * 60 * minute))}d ago`
}

function FilterMenu({
  kindValue,
  onKindChange,
  dateValue,
  onDateChange,
  active,
}: {
  kindValue: KindFilter
  onKindChange: (value: KindFilter) => void
  dateValue: DateFilter
  onDateChange: (value: DateFilter) => void
  active: boolean
}) {
  const kindSummary =
    KIND_FILTERS.find((k) => k.value === kindValue)?.label ?? "All comments"

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
            <IconFilter className="size-4" />
            <span>Kind</span>
            <span className="ml-auto max-w-28 truncate text-xs text-muted-foreground">
              {kindSummary}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-72">
            <DropdownMenuRadioGroup
              value={kindValue}
              onValueChange={(v) => onKindChange(v as KindFilter)}
            >
              {KIND_FILTERS.map((k) => (
                <DropdownMenuRadioItem key={k.value} value={k.value}>
                  {k.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
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
  comment: UnifiedComment
  onResolve: () => void
  onSave: (body: string) => Promise<void>
}) {
  const { visual, code } = comment
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    setEditing(false)
  }, [comment.id])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5">
        <KindIcon
          kind={comment.kind}
          className="size-4 text-muted-foreground"
        />
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
            {code !== undefined && (
              <>
                <Field label="File">
                  <code className="font-mono">
                    {code.filePath}:{code.lineNumber}
                  </code>
                </Field>
                <Field label="Side">{code.side}</Field>
                <Field label="Target">
                  <code className="font-mono">{code.target}</code>
                </Field>
              </>
            )}
            {visual !== undefined && (
              <>
                <Field label="Page">
                  <a
                    href={visual.pageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 max-w-full items-center gap-1 break-all underline underline-offset-2"
                  >
                    <span className="min-w-0">{visual.pageUrl}</span>
                    <IconExternalLink className="size-3 shrink-0" />
                  </a>
                </Field>
                <Field label="Element">
                  <code className="font-mono break-all">{visual.label}</code>
                </Field>
                <Field label="Selector">
                  <code className="font-mono break-all">{visual.selector}</code>
                </Field>
                {visual.sourceFile !== undefined && (
                  <Field label="Source">
                    <code className="font-mono break-all">
                      {visual.sourceFile}
                      {visual.sourceLine === undefined
                        ? ""
                        : `:${visual.sourceLine}`}
                    </code>
                  </Field>
                )}
                <Field label="Viewport">
                  {visual.viewport.width} × {visual.viewport.height}
                </Field>
              </>
            )}
          </div>

          {visual !== undefined && (
            <div className="min-w-0 border-t pt-3">
              <p className="mb-1.5 text-xs text-muted-foreground">Markup</p>
              <pre className="max-w-full overflow-x-hidden rounded-md bg-muted p-2.5 font-mono text-xs break-all whitespace-pre-wrap">
                {visual.elementHtml}
              </pre>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function CommentsPage() {
  const codeComments = useComments()
  const visualComments = useVisualComments()
  const commentActions = useCommentsActions()
  const visualActions = useVisualCommentsActions()
  const chatActions = useChatsActions()
  const chatModels = useChatModels()
  const chats = useChats()
  const repo = useRepo()
  const navigate = useNavigate()

  const [sidebarWidth, setSidebarWidth] = useState(
    useUiPrefs().workspaceSidebarWidth
  )
  const [kind, setKind] = useState<KindFilter>(noFilters.kind)
  const [date, setDate] = useState<DateFilter>(noFilters.date)
  const [search, setSearch] = useState(noFilters.search)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [assignBarDismissed, setAssignBarDismissed] = useState(false)

  const all = useMemo(
    () => unify(codeComments.data ?? [], visualComments.data ?? []),
    [codeComments.data, visualComments.data]
  )

  const filters = useMemo(() => ({ kind, date, search }), [kind, date, search])
  const filtered = useMemo(() => applyFilters(all, filters), [all, filters])
  const groups = useMemo(() => groupByKind(filtered), [filtered])
  const filtersOn = areFiltersActive(filters)

  const selected = filtered.find((c) => c.id === selectedId) ?? null

  useEffect(() => {
    if (all.length > 0) setAssignBarDismissed(false)
  }, [all.length])

  const remove = async (comment: UnifiedComment) => {
    if (comment.visual !== undefined) {
      await visualActions.remove(comment.id)
      return
    }
    if (comment.code !== undefined) await commentActions.remove(comment.code)
  }

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
      void navigate({ to: "/chats/$chatId", params: { chatId } })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not assign comments"
      )
    }
  }

  const resolve = async (comment: UnifiedComment) => {
    try {
      await remove(comment)
      if (comment.id === selectedId) setSelectedId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "resolve failed")
    }
  }

  const save = async (comment: UnifiedComment, body: string) => {
    if (comment.visual !== undefined) {
      await visualActions.update(comment.id, body)
      return
    }
    if (comment.code !== undefined) {
      await commentActions.update(comment.code, body)
    }
  }

  const openComment = (comment: UnifiedComment) => {
    setSelectedId(comment.id)
    if (comment.code === undefined) return
    const { filePath, target } = comment.code
    if (target === "worktree") {
      void navigate({ to: "/commit", search: { path: filePath } })
      return
    }
    if (target.startsWith("commit-")) {
      void navigate({
        to: "/browse/commit/$sha",
        params: { sha: target.slice("commit-".length) },
        search: { path: filePath },
      })
      return
    }
    if (target.includes("...")) {
      const [base, head] = target.split("...")
      if (base === undefined || head === undefined) return
      void navigate({
        to: "/browse/range",
        search: { path: filePath, base, head },
      })
      return
    }
    if (target.startsWith("pr-")) {
      void navigate({
        to: "/review/$pull",
        params: { pull: target.slice("pr-".length) },
        search: { path: filePath },
      })
    }
  }

  const renderRow = (comment: UnifiedComment) => (
    <button
      key={comment.id}
      type="button"
      onClick={() => openComment(comment)}
      className={cn(
        "group/row mb-0.5 flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60",
        comment.id === selectedId && "bg-muted"
      )}
    >
      <KindIcon
        kind={comment.kind}
        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{comment.body}</div>
        <div className="truncate font-mono text-xs text-muted-foreground">
          {comment.anchor}
        </div>
      </div>
      <span
        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-destructive"
        aria-label="Resolve comment"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void resolve(comment)
        }}
      >
        <IconX className="size-3.5" />
      </span>
    </button>
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
            kindValue={kind}
            onKindChange={setKind}
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
              No comments yet. Leave one on a diff line, or click an element in
              a running app with the byconvo picker.
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
                  setKind(noFilters.kind)
                  setDate(noFilters.date)
                  setSearch(noFilters.search)
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : kind === "all" ? (
            groups.map((group) => (
              <div key={group.kind} className="mb-1">
                <div className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  <KindIcon kind={group.kind} className="size-3 shrink-0" />
                  <span className="truncate">{KIND_LABELS[group.kind]}</span>
                  <span className="ml-auto tabular-nums">
                    {group.comments.length}
                  </span>
                </div>
                {group.comments.map(renderRow)}
              </div>
            ))
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
