import {
  IconCalendar,
  IconFile,
  IconGitBranch,
  IconGitFork,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ALL_REFS, logRefLabel, type LogQuery } from "@/lib/api/types";
import { pathName } from "@/lib/display-path";
import { ProjectAvatar } from "@/interactions/workspace/components/project-avatar";
import type { BranchInfo } from "@reviewer/core/repo";
import type { RepoEntry } from "@reviewer/core/workspace";
import { cn } from "@/lib/utils";

/** Parse a `YYYY-MM-DD` string as a local date (no timezone shift). */
const parseISODate = (value: string): Date | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return undefined;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** Format a local date back to `YYYY-MM-DD`. */
const toISODate = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

interface LogFiltersProps {
  refName: string;
  branches: ReadonlyArray<BranchInfo>;
  query: LogQuery;
  onRefChange: (ref: string) => void;
  onQueryChange: (query: LogQuery) => void;
  /**
   * The project's roots, when it holds more than one. Their presence swaps the
   * branch selector for a repository one: the history covers every root, and a
   * branch name belongs to a single one of them, so narrowing by branch is not
   * a question this list can answer — narrowing by root is.
   */
  repos?: ReadonlyArray<RepoEntry>;
  /** The root the history is narrowed to, or null for all of them. */
  repoFilter?: string | null;
  /** The project's own name — the avatar shown when no root is chosen. */
  projectName?: string;
  onRepoFilterChange?: (repoPath: string | null) => void;
}

/** The "no root chosen" option's value — a combobox needs a real string. */
const ALL_REPOS = "\u0000all-repos";

const blank = (value: string): string | null =>
  value.trim().length > 0 ? value.trim() : null;

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
  repos,
  repoFilter = null,
  projectName,
  onRepoFilterChange,
}: LogFiltersProps) {
  const [grep, setGrep] = useState(query.grep ?? "");
  const [author, setAuthor] = useState(query.author ?? "");
  const [dateOpen, setDateOpen] = useState(false);
  const afterDate =
    query.after !== null ? parseISODate(query.after) : undefined;

  useEffect(() => setGrep(query.grep ?? ""), [query.grep]);
  useEffect(() => setAuthor(query.author ?? ""), [query.author]);

  const apply = (patch: Partial<LogQuery>) =>
    onQueryChange({ ...query, ...patch });

  const hasFilters =
    query.grep !== null ||
    query.author !== null ||
    query.path !== null ||
    query.after !== null ||
    query.before !== null;

  const knownRef =
    refName === ALL_REFS || branches.some((b) => b.name === refName);
  // The searchable ref list — "All branches" (the whole graph), every local
  // branch, plus the active ref itself when it isn't one (a detached commit,
  // tag or remote ref driving the log).
  const refItems = [
    ALL_REFS,
    ...(knownRef ? [] : [refName]),
    ...branches.map((b) => b.name),
  ];

  const byRepo = repos !== undefined && repos.length > 1;
  const repoItems = [ALL_REPOS, ...(repos ?? []).map((repo) => repo.path)];
  const repoNameOf = (path: string) =>
    repos?.find((repo) => repo.path === path)?.name ?? pathName(path);

  return (
    /* The tab strip this row sits under measures its rhythm in one unit: a 4px
       inset off the pane edge and the 10px each item carries inside itself, so
       the first control's edge lands on the first tab's and the two rows read
       as one piece of chrome rather than two strips that happen to be stacked.
       Between neighbours it takes double the strip's 2px: a tab only draws its
       chip under the pointer or the selection, so its neighbours are never two
       boxes side by side — these always are, and at 2px their edges touch. */
    <div className="flex min-h-9 flex-wrap items-center gap-1 border-b px-1 py-0.5">
      {byRepo && (
        <Combobox<string>
          value={repoFilter ?? ALL_REPOS}
          items={repoItems}
          onValueChange={(value) => {
            if (value === null) return;
            onRepoFilterChange?.(value === ALL_REPOS ? null : value);
          }}
        >
          <ComboboxTrigger
            size="sm"
            className="w-48 px-2.5 text-xs"
            aria-label="Repository"
          >
            <ProjectAvatar
              name={
                repoFilter === null
                  ? (projectName ?? "")
                  : repoNameOf(repoFilter)
              }
              className="size-4 text-[8px]"
            />
            <ComboboxValue>
              {(value: string) =>
                value === ALL_REPOS ? "All repositories" : repoNameOf(value)
              }
            </ComboboxValue>
          </ComboboxTrigger>
          <ComboboxContent className="w-72">
            <ComboboxInput placeholder="Search repositories…" />
            <ComboboxEmpty>No repositories found.</ComboboxEmpty>
            <ComboboxList>
              {(path: string) => (
                <ComboboxItem key={path} value={path}>
                  {/* One flex row: the item wraps its children in a truncating
                      block, so a second child would stack under the first. */}
                  <span className="flex min-w-0 items-center gap-2">
                    <ProjectAvatar
                      name={
                        path === ALL_REPOS
                          ? (projectName ?? "")
                          : repoNameOf(path)
                      }
                      className="size-4 text-[8px]"
                    />
                    <span className="truncate">
                      {path === ALL_REPOS
                        ? "All repositories"
                        : repoNameOf(path)}
                    </span>
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}

      {!byRepo && (
        <Combobox<string>
          value={refName}
          items={refItems}
          onValueChange={(value) => {
            if (value !== null) onRefChange(value);
          }}
        >
          <ComboboxTrigger
            size="sm"
            className="w-48 px-2.5 text-xs"
            aria-label="Branch"
          >
            {refName === ALL_REFS ? (
              <IconGitFork className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <IconGitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <ComboboxValue>
              {(value: string) => logRefLabel(value)}
            </ComboboxValue>
          </ComboboxTrigger>
          <ComboboxContent className="w-72">
            <ComboboxInput placeholder="Search branches…" />
            <ComboboxEmpty>No branches found.</ComboboxEmpty>
            <ComboboxList>
              {(name: string) => (
                <ComboboxItem key={name} value={name}>
                  {logRefLabel(name)}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      )}

      {query.path !== null && (
        <div
          className="flex h-7 max-w-64 shrink-0 items-center gap-1 rounded-md bg-input/50 pr-1 pl-2.5 text-xs"
          title={`History of ${query.path}`}
        >
          <IconFile className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{pathName(query.path)}</span>
          <button
            type="button"
            aria-label="Show all files"
            title="Show all files"
            onClick={() => apply({ path: null, follow: false })}
            className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <IconX className="size-3.5" />
          </button>
        </div>
      )}

      <div className="relative flex min-w-44 flex-1 items-center">
        <IconSearch className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground" />
        <Input
          className="h-7 pr-16 pl-7 text-xs"
          placeholder="Text or hash"
          aria-label="Filter by text or hash"
          value={grep}
          onChange={(e) => setGrep(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ grep: blank(grep) });
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
          if (e.key === "Enter") apply({ author: blank(author) });
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
                "w-36 justify-start rounded-md border border-transparent bg-input/50 px-2.5 text-xs font-normal hover:bg-input/50 dark:bg-input/50 dark:hover:bg-input/50",
                query.after === null && "text-muted-foreground"
              )}
              aria-label="Since date"
            />
          }
        >
          <IconCalendar className="size-3.5 text-muted-foreground" />
          {afterDate ? afterDate.toLocaleDateString() : "Since date"}
        </PopoverTrigger>
        <PopoverContent className="w-auto gap-0 rounded-md p-0">
          <Calendar
            mode="single"
            autoFocus
            selected={afterDate}
            onSelect={(date) => {
              apply({ after: date ? toISODate(date) : null });
              setDateOpen(false);
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
              follow: false,
            })
          }
        >
          <IconX className="size-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}

function FilterToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
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
  );
}
