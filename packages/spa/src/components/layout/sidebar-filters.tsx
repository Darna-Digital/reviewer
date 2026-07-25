/**
 * The Linear-style search + filter header shared by the workspace sidebars
 * (agent threads, terminal threads, pull requests): a free-text box and one
 * dropdown that fans out into a branch and a time-window radio group.
 */
import {
  IconAdjustmentsHorizontal,
  IconClock,
  IconGitBranch,
  IconSearch,
  IconX,
} from "@tabler/icons-react"
import { useState } from "react"
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
  DATE_FILTERS,
  dateFilterLabel,
  type DateFilter,
} from "@/lib/date-filter"

export const ALL_BRANCHES = "__all__"

/** Display label for a branch ("" → items with no branch of their own). */
export const branchLabel = (branch: string) =>
  branch.length > 0 ? branch : "No branch"

export function SidebarSearch({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 rounded-md pr-7 pl-8"
      />
      {value.length > 0 && (
        <button
          type="button"
          aria-label="Clear search"
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => onChange("")}
        >
          <IconX className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/**
 * A single Linear-style filter button. It opens a dropdown whose entries fan
 * out into a submenu per filter — Branch and Time — each a radio group over its
 * options. A dot on the trigger marks any active filter.
 */
export function SidebarFilterMenu({
  label,
  branchValue,
  branches,
  onBranchChange,
  dateValue,
  onDateChange,
  active,
}: {
  label: string
  branchValue: string
  branches: ReadonlyArray<string>
  onBranchChange: (branch: string) => void
  dateValue: DateFilter
  onDateChange: (value: DateFilter) => void
  active: boolean
}) {
  const [query, setQuery] = useState("")
  const q = query.trim().toLowerCase()
  const showAll = "all branches".includes(q)
  const shownBranches = branches.filter((b) => b.toLowerCase().includes(q))

  const branchSummary =
    branchValue === ALL_BRANCHES ? "All branches" : branchLabel(branchValue)
  const dateSummary = dateFilterLabel(dateValue)

  const pickBranch = (branch: string) => {
    onBranchChange(branch)
    setQuery("")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon"
            variant="ghost"
            className="relative size-7 shrink-0"
            aria-label={label}
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
            <IconGitBranch className="size-4" />
            <span>Branch</span>
            <span className="ml-auto max-w-[88px] truncate text-xs text-muted-foreground">
              {branchSummary}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-56 p-1">
            <div className="relative p-1">
              <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                aria-label="Search branches"
                placeholder="Search branches…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // Keep typing in the input rather than the menu's typeahead,
                // but still let Escape close and arrows move into the list.
                onKeyDown={(e) => {
                  if (!["Escape", "ArrowDown", "ArrowUp"].includes(e.key))
                    e.stopPropagation()
                }}
                className="h-7 rounded-md pl-8"
              />
            </div>
            <div className="mt-1 max-h-64 overflow-y-auto">
              {!showAll && shownBranches.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No branches match.
                </p>
              ) : (
                <DropdownMenuRadioGroup
                  value={branchValue}
                  onValueChange={pickBranch}
                >
                  {showAll && (
                    <DropdownMenuRadioItem value={ALL_BRANCHES}>
                      All branches
                    </DropdownMenuRadioItem>
                  )}
                  {shownBranches.map((b) => (
                    <DropdownMenuRadioItem key={b} value={b}>
                      <span className="truncate">{branchLabel(b)}</span>
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconClock className="size-4" />
            <span>Time</span>
            <span className="ml-auto max-w-[88px] truncate text-xs text-muted-foreground">
              {dateSummary}
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
