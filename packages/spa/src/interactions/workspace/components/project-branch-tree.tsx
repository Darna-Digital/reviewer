/**
 * The Branches panel for a project of several roots: each root heads its own
 * section, holding that root's branch tree.
 *
 * This is the JetBrains shape — "Recent Branches in web-app", "Local Branches
 * in backend-app" — and it is why the per-root trees are the existing
 * `BranchTree` rather than a rewrite of it: what a branch list does inside one
 * repository has not changed, only how many of them are on screen.
 *
 * A section is collapsible, and the root the git views currently follow starts
 * open, because that is the one being worked in.
 */
import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";
import { useState } from "react";
import { BranchTree } from "@/components/git/branch-tree";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "./project-avatar";
import type { RepoBranches } from "@byconvo/core/project";

interface ProjectBranchTreeProps {
  repos: ReadonlyArray<RepoBranches>;
  /** The root the git views follow — its section starts expanded. */
  currentRepo: string | null;
  /** The ref the history is showing, for the selected highlight. */
  selectedRef: string | null;
  query?: string;
  onSelect: (repoPath: string, ref: string) => void;
  onCheckout: (repoPath: string, ref: string) => void;
}

export function ProjectBranchTree({
  repos,
  currentRepo,
  selectedRef,
  query,
  onSelect,
  onCheckout,
}: ProjectBranchTreeProps) {
  // Only the roots deliberately closed are remembered: a root cloned into the
  // project while this is open should arrive expanded, not silently collapsed.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        repos.filter((r) => r.repo.path !== currentRepo).map((r) => r.repo.path)
      )
  );
  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <div className="flex flex-col">
      {repos.map((entry) => {
        const open = !collapsed.has(entry.repo.path);
        const isCurrent = entry.repo.path === currentRepo;
        return (
          <div key={entry.repo.path}>
            <button
              type="button"
              aria-expanded={open}
              onClick={() => toggle(entry.repo.path)}
              className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm outline-none hover:bg-elevate focus-visible:bg-elevate"
            >
              {open ? (
                <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <ProjectAvatar name={entry.repo.name} className="size-4" />
              <span className={cn("truncate", isCurrent && "font-medium")}>
                {entry.repo.name}
              </span>
              <span className="ml-auto shrink-0 rounded bg-elevate px-1.5 py-0.5 text-xs text-muted-foreground">
                {entry.repo.branch ?? "detached"}
              </span>
            </button>
            {open && (
              <div className="pl-3">
                <BranchTree
                  branches={entry.branches}
                  remoteBranches={entry.remoteBranches}
                  currentBranch={entry.repo.branch}
                  // A ref is only selected in the root the history is showing;
                  // the same branch name in another root is a different branch.
                  selectedRef={isCurrent ? selectedRef : null}
                  query={query}
                  onSelect={(ref) => onSelect(entry.repo.path, ref)}
                  onCheckout={(ref) => onCheckout(entry.repo.path, ref)}
                />
              </div>
            )}
          </div>
        );
      })}
      {repos.length === 0 && (
        <div className="px-2.5 py-6 text-center text-sm text-muted-foreground">
          No repositories in this project.
        </div>
      )}
    </div>
  );
}
