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
import { useMemo, useState } from "react"
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
import {
  KIND_FILTERS,
  applyFilters,
  filtersActive as areFiltersActive,
  groupByKind,
  noFilters,
  unify,
  type CommentKind,
  type KindFilter,
  type UnifiedComment,
} from "@/interactions/comments/functions/comment-list.functions"
import {
  DATE_FILTERS,
  dateFilterLabel,
  type DateFilter,
} from "@/lib/date-filter"
import { useComments, useVisualComments } from "@/lib/queries"
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
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconFilter className="size-4" />
            <span>Kind</span>
            <span className="ml-auto max-w-[88px] truncate text-xs text-muted-foreground">
              {kindSummary}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
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
            <span className="ml-auto max-w-[88px] truncate text-xs text-muted-foreground">
              {dateFilterLabel(dateValue)}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
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
}: {
  comment: UnifiedComment
  onResolve: () => void
}) {
  const { visual, code } = comment
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
        <Button size="sm" variant="outline" className="h-7" onClick={onResolve}>
          Resolve
        </Button>
      </header>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <p className="text-sm whitespace-pre-wrap">{comment.body}</p>

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
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                >
                  {visual.pageUrl}
                  <IconExternalLink className="size-3" />
                </a>
              </Field>
              <Field label="Element">
                <code className="font-mono">{visual.label}</code>
              </Field>
              <Field label="Selector">
                <code className="font-mono">{visual.selector}</code>
              </Field>
              {visual.sourceFile !== undefined && (
                <Field label="Source">
                  <code className="font-mono">
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
          <div className="border-t pt-3">
            <p className="mb-1.5 text-xs text-muted-foreground">Markup</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-2.5 font-mono text-xs">
              {visual.elementHtml}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

export function CommentsPage() {
  const codeComments = useComments()
  const visualComments = useVisualComments()
  const commentActions = useCommentsActions()
  const visualActions = useVisualCommentsActions()

  const [sidebarWidth, setSidebarWidth] = useState(
    useUiPrefs().workspaceSidebarWidth
  )
  const [kind, setKind] = useState<KindFilter>(noFilters.kind)
  const [date, setDate] = useState<DateFilter>(noFilters.date)
  const [search, setSearch] = useState(noFilters.search)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const all = useMemo(
    () => unify(codeComments.data ?? [], visualComments.data ?? []),
    [codeComments.data, visualComments.data]
  )

  const filters = useMemo(() => ({ kind, date, search }), [kind, date, search])
  const filtered = useMemo(() => applyFilters(all, filters), [all, filters])
  const groups = useMemo(() => groupByKind(filtered), [filtered])
  const filtersOn = areFiltersActive(filters)

  const selected = filtered.find((c) => c.id === selectedId) ?? null

  const resolve = async (comment: UnifiedComment) => {
    try {
      if (comment.visual !== undefined) {
        await visualActions.remove(comment.id)
      } else if (comment.code !== undefined) {
        await commentActions.remove(comment.code)
      }
      if (comment.id === selectedId) setSelectedId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "resolve failed")
    }
  }

  const renderRow = (comment: UnifiedComment) => (
    <button
      key={comment.id}
      type="button"
      onClick={() => setSelectedId(comment.id)}
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
        <div className="min-h-0 flex-1 overflow-auto px-1 py-2">
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
        </div>
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
          />
        )}
      </section>
    </div>
  )
}
