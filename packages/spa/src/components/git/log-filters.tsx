import {
  IconCalendar,
  IconGitBranch,
  IconSearch,
  IconX,
} from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { LogQuery } from "@/lib/api/types"
import type { BranchInfo } from "@byconvo/core"
import { cn } from "@/lib/utils"

/** Parse a `YYYY-MM-DD` string as a local date (no timezone shift). */
const parseISODate = (value: string): Date | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (match === null) return undefined
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  )
  return Number.isNaN(date.getTime()) ? undefined : date
}

/** Format a local date back to `YYYY-MM-DD`. */
const toISODate = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

interface LogFiltersProps {
  refName: string
  branches: ReadonlyArray<BranchInfo>
  query: LogQuery
  onRefChange: (ref: string) => void
  onQueryChange: (query: LogQuery) => void
}

const blank = (value: string): string | null =>
  value.trim().length > 0 ? value.trim() : null

/**
 * History toolbar. Text fields apply on Enter/blur; the branch picker, toggles
 * and date apply immediately. Local drafts keep typing responsive between
 * commits, and re-sync when the query is cleared from outside.
 */
export function LogFilters({
  refName,
  branches,
  query,
  onRefChange,
  onQueryChange,
}: LogFiltersProps) {
  const [grep, setGrep] = useState(query.grep ?? "")
  const [author, setAuthor] = useState(query.author ?? "")
  const [dateOpen, setDateOpen] = useState(false)
  const afterDate = query.after !== null ? parseISODate(query.after) : undefined

  useEffect(() => setGrep(query.grep ?? ""), [query.grep])
  useEffect(() => setAuthor(query.author ?? ""), [query.author])

  const apply = (patch: Partial<LogQuery>) =>
    onQueryChange({ ...query, ...patch })

  const hasFilters =
    query.grep !== null ||
    query.author !== null ||
    query.path !== null ||
    query.after !== null ||
    query.before !== null

  const knownRef = branches.some((b) => b.name === refName)
  // The searchable ref list — every local branch, plus the active ref itself
  // when it isn't one (a detached commit, tag or remote ref driving the log).
  const refItems = knownRef
    ? branches.map((b) => b.name)
    : [refName, ...branches.map((b) => b.name)]

  return (
    <div className="flex flex-wrap items-center gap-2 border-b p-2">
      <Combobox<string>
        value={refName}
        items={refItems}
        onValueChange={(value) => {
          if (value !== null) onRefChange(value)
        }}
      >
        <ComboboxTrigger size="sm" className="w-48 text-xs" aria-label="Branch">
          <IconGitBranch className="size-3.5 shrink-0 text-muted-foreground" />
          <ComboboxValue />
        </ComboboxTrigger>
        <ComboboxContent>
          <ComboboxInput placeholder="Search branches…" />
          <ComboboxEmpty>No branches found.</ComboboxEmpty>
          <ComboboxList>
            {(name: string) => (
              <ComboboxItem key={name} value={name}>
                <Tooltip>
                  <TooltipTrigger render={<span className="truncate" />}>
                    {name}
                  </TooltipTrigger>
                  <TooltipContent side="right">{name}</TooltipContent>
                </Tooltip>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>

      <div className="relative flex min-w-44 flex-1 items-center">
        <IconSearch className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
        <Input
          className="h-7 pr-16 pl-7 text-xs"
          placeholder="Text or hash"
          aria-label="Filter by text or hash"
          value={grep}
          onChange={(e) => setGrep(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ grep: blank(grep) })
          }}
          onBlur={() => apply({ grep: blank(grep) })}
        />
        <div className="absolute right-1 flex items-center gap-0.5">
          <FilterToggle
            active={query.regex}
            label="Regular expression"
            onClick={() =>
              onQueryChange({
                ...query,
                grep: blank(grep),
                regex: !query.regex,
              })
            }
          >
            .*
          </FilterToggle>
          <FilterToggle
            active={query.caseSensitive}
            label="Match case"
            onClick={() =>
              onQueryChange({
                ...query,
                grep: blank(grep),
                caseSensitive: !query.caseSensitive,
              })
            }
          >
            Cc
          </FilterToggle>
        </div>
      </div>

      <Input
        className="h-7 w-32 text-xs"
        placeholder="User"
        aria-label="Filter by author"
        value={author}
        onChange={(e) => setAuthor(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply({ author: blank(author) })
        }}
        onBlur={() => apply({ author: blank(author) })}
      />

      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-36 justify-start rounded-2xl border border-transparent bg-input/50 px-2.5 text-xs font-normal hover:bg-input/50 dark:bg-input/50 dark:hover:bg-input/50",
                query.after === null && "text-muted-foreground"
              )}
              aria-label="Since date"
            />
          }
        >
          <IconCalendar className="size-3.5 text-muted-foreground" />
          {afterDate ? afterDate.toLocaleDateString() : "Since date"}
        </PopoverTrigger>
        <PopoverContent className="w-auto gap-0 rounded-2xl p-0">
          <Calendar
            mode="single"
            autoFocus
            selected={afterDate}
            onSelect={(date) => {
              apply({ after: date ? toISODate(date) : null })
              setDateOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={() =>
            onQueryChange({
              author: null,
              grep: null,
              regex: query.regex,
              caseSensitive: query.caseSensitive,
              after: null,
              before: null,
              path: null,
            })
          }
        >
          <IconX className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  )
}

function FilterToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-5 min-w-6 items-center justify-center rounded px-1 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}
