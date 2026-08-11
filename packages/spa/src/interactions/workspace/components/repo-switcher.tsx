/**
 * RepoSwitcher — the chip that says which of the project's git roots the git
 * views are following, and moves between them. It only appears for a project
 * holding more than one; a single-root project has nothing to switch.
 *
 * Modelled on the JetBrains branch widget for multi-root projects: the roots
 * are listed with the branch each is on, the current one is marked, and the
 * header says whether they still agree — a multi-root project is normally
 * worked on one branch across every root, so "branches have diverged" is worth
 * saying out loud rather than leaving to be discovered mid-review.
 */
import { IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  handleSearchKeyDown,
  handleSearchRowKeyDown,
} from "@/components/ui/search-keydown";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "./project-avatar";
import {
  activeRepo,
  branchesDiverged,
  commonBranch,
  isMultiRepo,
  repoMatches,
} from "@byconvo/core/workspace";
import type { WorkspaceInfo } from "@byconvo/core/workspace";

interface RepoSwitcherProps {
  workspace: WorkspaceInfo | undefined;
  onSelect: (path: string) => void;
  /** Which way the popover opens — "top" for a bar pinned to the bottom. */
  side?: "top" | "bottom";
}

const rowClass =
  "flex w-full min-w-0 items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm outline-hidden select-none hover:bg-elevate hover:text-foreground focus:bg-elevate focus:text-foreground";

export function RepoSwitcher({ workspace, onSelect, side }: RepoSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const repos = useMemo(() => workspace?.repos ?? [], [workspace]);
  const matches = useMemo(
    () => repos.filter((repo) => repoMatches(repo, query)),
    [repos, query]
  );

  if (workspace === undefined || !isMultiRepo(workspace)) return null;

  const current = activeRepo(workspace);
  const shared = commonBranch(repos);
  const diverged = branchesDiverged(repos);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="chip"
            className="max-w-56 gap-2 px-2 py-1.5"
          >
            {current === null ? (
              <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ProjectAvatar name={current.name} />
            )}
            <span className="truncate">{current?.name ?? "Repository"}</span>
            <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        side={side ?? "bottom"}
        onKeyDown={handleSearchRowKeyDown}
        className="w-72 gap-0 overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5">
          <input
            ref={searchRef}
            data-search-input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search repositories"
            aria-label="Search repositories"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="px-2.5 pt-2 pb-1 text-xs text-muted-foreground">
          {diverged
            ? "Branches have diverged"
            : shared !== null
              ? `All on ${shared}`
              : `${repos.length} repositories`}
        </div>

        <ScrollArea className="max-h-80">
          <div className="p-1">
            {matches.map((repo) => {
              const isCurrent = repo.path === workspace.current;
              return (
                <button
                  key={repo.path}
                  type="button"
                  data-search-row
                  className={rowClass}
                  onClick={() => {
                    setOpen(false);
                    onSelect(repo.path);
                  }}
                >
                  <ProjectAvatar name={repo.name} />
                  <span className={cn("truncate", isCurrent && "font-medium")}>
                    {repo.name}
                  </span>
                  <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    <span className="max-w-28 truncate text-xs text-muted-foreground">
                      {repo.branch ?? "detached"}
                    </span>
                    {isCurrent && (
                      <IconCheck className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </span>
                </button>
              );
            })}
            {matches.length === 0 && (
              <div className="px-2.5 py-6 text-center text-sm text-muted-foreground">
                No repositories match “{query}”
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
