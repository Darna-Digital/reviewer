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
} from "@tabler/icons-react";
import { useState, type KeyboardEventHandler, type Ref } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  DATE_FILTERS,
  dateFilterLabel,
  type DateFilter,
} from "@/lib/date-filter";

export const ALL_BRANCHES = "__all__";

/** Display label for a branch ("" → items with no branch of their own). */
export const branchLabel = (branch: string) =>
  branch.length > 0 ? branch : "No branch";

export function SidebarSearch({
  label,
  placeholder,
  value,
  onChange,
  onKeyDown,
  inputRef,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  /** For a box whose list answers keys of its own. */
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** For a box something else decides the moment to put the caret in. */
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <div className="relative min-w-0 flex-1">
      <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
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
  );
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
  label: string;
  branchValue: string;
  branches: ReadonlyArray<string>;
  onBranchChange: (branch: string) => void;
  dateValue: DateFilter;
  onDateChange: (value: DateFilter) => void;
  active: boolean;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const showAll = "all branches".includes(q);
  const shownBranches = branches.filter((b) => b.toLowerCase().includes(q));

  const branchSummary =
    branchValue === ALL_BRANCHES ? "All branches" : branchLabel(branchValue);
  const dateSummary = dateFilterLabel(dateValue);

  const pickBranch = (branch: string) => {
    onBranchChange(branch);
    setQuery("");
  };

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
              <span className="absolute top-1 right-1 size-1.5 rounded-full bg-brand-500" />
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72 max-w-72 min-w-0">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconGitBranch className="size-4 shrink-0" />
            <span className="shrink-0">Branch</span>
            <span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
              {branchSummary}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <div className="flex min-w-0 items-center gap-2 border-b px-2.5 py-2">
              <IconSearch className="size-4 shrink-0 text-muted-foreground" />
              <input
                autoFocus
                aria-label="Search branches"
                placeholder="Search branches…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                // Keep typing in the input rather than the menu's typeahead,
                // but still let Escape close and arrows move into the list.
                onKeyDown={(e) => {
                  if (e.key === "Escape") return;
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    e.stopPropagation();
                    const popup = e.currentTarget.closest(
                      '[data-slot="dropdown-menu-sub-content"], [data-slot="dropdown-menu-content"]'
                    );
                    if (!(popup instanceof HTMLElement)) return;
                    const items = popup.querySelectorAll<HTMLElement>(
                      '[data-slot="dropdown-menu-radio-item"]:not([data-disabled])'
                    );
                    if (items.length === 0) return;
                    const item =
                      e.key === "ArrowDown"
                        ? items[0]
                        : items[items.length - 1];
                    item.focus();
                    return;
                  }
                  e.stopPropagation();
                }}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            {/* Native overflow (not ScrollArea) so intrinsic content width
                can't blow past the popup and defeat truncate on long labels. */}
            <div className="max-h-64 min-w-0 scroll-fade overflow-x-hidden overflow-y-auto p-1">
              {!showAll && shownBranches.length === 0 ? (
                <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">
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
                      {branchLabel(b)}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
            </div>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconClock className="size-4 shrink-0" />
            <span className="shrink-0">Time</span>
            <span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">
              {dateSummary}
            </span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
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
  );
}
