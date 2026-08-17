/**
 * BranchSwitcher — the top-bar branch dropdown, ported from the client's
 * `GitWidget` to the shadcn (base-ui) `DropdownMenu` primitives. It keeps the
 * JetBrains-style feature set: a filter box, collapsible Recent / Local /
 * Remote sections, folder grouping by the first path segment, ahead/behind and
 * upstream badges, and a per-branch action submenu (checkout, new branch from,
 * compare, merge, rebase, rename, delete, …). Everything acts on a branch that
 * was picked first, so there are no repo-wide actions at the menu's top level.
 */
import { useEffect, useRef, useState } from "react";
import {
  IconChevronDown,
  IconChevronRight,
  IconFolder,
  IconGitBranch,
  IconSearch,
  IconStarFilled,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useBranchActionControls,
  type BranchActionScope,
} from "@/components/layout/branch-actions";
import {
  groupBranchesByFolder,
  splitBranchFolder,
} from "@/components/layout/branch-groups";
import { handleSearchKeyDown } from "@/components/ui/search-keydown";
import { cn } from "@/lib/utils";
import { useSurfaceBackground } from "@/lib/surface-context";
import { ProjectAvatar } from "@/interactions/workspace/components/project-avatar";
import type { RepoBranches } from "@byconvo/core/project";
import type { RepoEntry } from "@byconvo/core/workspace";
import type { BranchInfo, RemoteBranchInfo } from "@byconvo/core/repo";

interface BranchSwitcherProps {
  current: string | null;
  branches: ReadonlyArray<BranchInfo>;
  remoteBranches: ReadonlyArray<RemoteBranchInfo>;
  busy: boolean;
  onCheckout: (ref: string) => void;
  onCheckoutAndUpdate: (ref: string) => void;
  onCreateBranch: (name: string, startPoint: string | null) => void;
  onCompare: (base: string, head: string) => void;
  onMerge: (branch: string) => void;
  onRebase: (onto: string) => void;
  onFetch: () => void;
  onPush: () => void;
  onRenameBranch: (from: string, to: string) => void;
  onDeleteBranch: (name: string) => void;
  /** Which way the menu opens — "top" for a bar pinned to the bottom. */
  side?: "top" | "bottom";
  /**
   * Every root's branches, when the project holds more than one. Their
   * presence moves the menu's whole body one level up: the top level lists the
   * roots, and each root expands into exactly the menu a single-repo project
   * gets — Recent / Local / Remote, folders, the per-branch actions. The
   * design does not change; it just starts once per repository.
   */
  repos?: ReadonlyArray<RepoBranches>;
  /** The root the git views follow — marked, and the one actions run in. */
  currentRepo?: RepoEntry | null;
  /**
   * Make `repoPath` the current root before acting in it. Actions run wherever
   * the git views point, so acting in another root goes through this first;
   * resolves false when the switch failed and the action must not run.
   */
  onFollowRepo?: (repoPath: string) => Promise<boolean>;
}

export function BranchSwitcher(props: BranchSwitcherProps) {
  const { current, branches, remoteBranches } = props;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Recent + Local open by default, Remote collapsed — like JetBrains.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    recent: false,
    local: false,
    remote: true,
  });
  const searchRef = useRef<HTMLInputElement>(null);

  // base-ui highlights the first item on open; pull focus back to the filter.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const q = query.trim().toLowerCase();
  const matches = (text: string) =>
    q.length === 0 || text.toLowerCase().includes(q);
  // While searching, force every section open so hits are never hidden.
  const isCollapsed = (id: string) => q.length === 0 && collapsed[id] === true;
  const toggleSection = (id: string) =>
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));

  const currentName = current ?? branches.find((b) => b.isCurrent)?.name ?? "—";
  // The menu nests per root only once there are several; a single root keeps
  // the flat body it has always had.
  const multiRepo = (props.repos ?? []).length > 1;
  const currentRepoPath = props.currentRepo?.path ?? null;
  const actions = useBranchActionControls({
    ...props,
    currentRepoPath,
  });

  /**
   * The Recent / Local / Remote body for one repository — exactly the menu a
   * single-repo project shows. A multi-root project renders this once per
   * root, inside that root's submenu; nothing about the body itself differs.
   */
  const renderSections = (
    scope: BranchActionScope & {
      readonly sectionBranches: ReadonlyArray<BranchInfo>;
      readonly sectionRemotes: ReadonlyArray<RemoteBranchInfo>;
      readonly keyPrefix: string;
    }
  ) => {
    const recent = scope.sectionBranches
      .filter((b) => matches(b.name))
      .slice(0, 5);
    const localGroups = groupBranchesByFolder(
      scope.sectionBranches.filter((b) => matches(b.name)),
      (b) => b.name
    );
    const remoteGroups = groupBranchesByFolder(
      scope.sectionRemotes.filter((b) => matches(b.name)),
      (b) => b.name
    );
    const localCount = localGroups.reduce((n, g) => n + g.items.length, 0);
    const remoteCount = remoteGroups.reduce((n, g) => n + g.items.length, 0);
    const k = scope.keyPrefix;

    return (
      <>
        <Section
          title="Recent"
          count={recent.length}
          collapsed={isCollapsed(`${k}recent`)}
          onToggle={() => toggleSection(`${k}recent`)}
        >
          {recent.map((b) => (
            <LocalRow key={`r-${b.name}`} branch={b} flat scope={scope} />
          ))}
        </Section>

        <Section
          title="Local"
          count={localCount}
          collapsed={isCollapsed(`${k}local`)}
          onToggle={() => toggleSection(`${k}local`)}
        >
          {localGroups.map((g) => (
            <Folder
              key={`l-${g.folder ?? "_"}`}
              folder={g.folder}
              forceOpen={q.length > 0}
            >
              {g.items.map((b) => (
                <LocalRow key={b.name} branch={b} scope={scope} />
              ))}
            </Folder>
          ))}
        </Section>

        <Section
          title="Remote"
          count={remoteCount}
          collapsed={isCollapsed(`${k}remote`)}
          onToggle={() => toggleSection(`${k}remote`)}
        >
          {remoteGroups.map((g) => (
            <Folder
              key={`rm-${g.folder ?? "_"}`}
              folder={g.folder}
              forceOpen={q.length > 0}
            >
              {g.items.map((b) => (
                <RemoteRow key={b.name} branch={b} scope={scope} />
              ))}
            </Folder>
          ))}
        </Section>

        {recent.length === 0 && localCount === 0 && remoteCount === 0 && (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No branches match “{query}”
          </div>
        )}
      </>
    );
  };

  const LocalRow = ({
    branch,
    flat,
    scope,
  }: {
    branch: BranchInfo;
    flat?: boolean;
    scope: BranchActionScope;
  }) => {
    const leaf = flat ? branch.name : splitBranchFolder(branch.name)[1];
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger
          className={cn(branch.isCurrent && "text-foreground")}
        >
          {branch.isCurrent ? (
            <IconStarFilled className="size-3.5 text-amber-500" />
          ) : (
            <IconGitBranch className="size-3.5 text-muted-foreground" />
          )}
          <span className={cn("truncate", branch.isCurrent && "font-medium")}>
            {leaf}
          </span>
          {(branch.ahead > 0 || branch.behind > 0) && (
            <span className="ml-auto flex shrink-0 items-center gap-1 text-xs tabular-nums">
              {branch.ahead > 0 && (
                <span
                  className="text-emerald-600 dark:text-emerald-400"
                  title={`${branch.ahead} outgoing`}
                >
                  ↑{branch.ahead}
                </span>
              )}
              {branch.behind > 0 && (
                <span
                  className="text-sky-600 dark:text-sky-400"
                  title={`${branch.behind} incoming`}
                >
                  ↓{branch.behind}
                </span>
              )}
            </span>
          )}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-72">
          {actions.actionItems(
            {
              display: branch.name,
              ref: branch.name,
              isCurrent: branch.isCurrent,
              isRemote: false,
            },
            scope
          )}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  };

  const RemoteRow = ({
    branch,
    scope,
  }: {
    branch: RemoteBranchInfo;
    scope: BranchActionScope;
  }) => (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <IconGitBranch className="size-3.5 text-muted-foreground" />
        <span className="truncate">{splitBranchFolder(branch.name)[1]}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {branch.remote}
        </span>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-72">
        {actions.actionItems(
          {
            display: branch.name,
            ref: branch.shortName,
            isCurrent: false,
            isRemote: true,
          },
          scope
        )}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="chip"
              className="max-w-64 gap-1.5 px-2"
            >
              <IconGitBranch className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{currentName}</span>
              <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
            </Button>
          }
        />
        <DropdownMenuContent
          align="start"
          side={props.side ?? "bottom"}
          className="max-h-[70vh] w-72 overflow-x-hidden overflow-y-auto p-0"
        >
          {/* Filter box — a plain row, not a menu item, so typing never navigates. */}
          <MenuFilterRow>
            <IconSearch className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              data-search-input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search branches"
              aria-label="Search branches"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </MenuFilterRow>

          <div className="p-1">
            {multiRepo &&
              props.repos?.map((entry) => (
                <DropdownMenuSub key={entry.repo.path}>
                  <DropdownMenuSubTrigger>
                    <ProjectAvatar name={entry.repo.name} className="size-4" />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate",
                        entry.repo.path === currentRepoPath && "font-medium"
                      )}
                    >
                      {entry.repo.name}
                    </span>
                    {/* Capped, or a long branch name eats the row and overflows it. */}
                    <span className="max-w-[50%] shrink-0 truncate text-xs text-muted-foreground">
                      {entry.repo.branch ?? "detached"}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-[60vh] w-72 overflow-x-hidden overflow-y-auto p-1">
                    {renderSections({
                      repoPath: entry.repo.path,
                      head: entry.repo.branch ?? "—",
                      sectionBranches: entry.branches,
                      sectionRemotes: entry.remoteBranches,
                      keyPrefix: `${entry.repo.path}:`,
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}

            {!multiRepo &&
              renderSections({
                repoPath: null,
                head: currentName,
                sectionBranches: branches,
                sectionRemotes: remoteBranches,
                keyPrefix: "",
              })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {actions.dialog}
    </>
  );
}

/**
 * The pinned filter row. It scrolls under the branch list, so it has to repaint
 * the menu's own surface — read from context rather than hardcoded, so it still
 * matches when the menu opens at a deeper elevation (inside a dialog, say).
 *
 * Exported for the worktree menu beside this one: the two answer neighbouring
 * questions in the same bar, and a filter row that sat a pixel differently in
 * one of them would be the thing you noticed.
 */
export function MenuFilterRow({ children }: { children: React.ReactNode }) {
  const surface = useSurfaceBackground();
  return (
    <div
      className={cn(
        "sticky top-0 z-10 flex items-center gap-2 border-b px-2.5 py-2",
        surface
      )}
    >
      {children}
    </div>
  );
}

/** A collapsible section header; hidden when it has no rows. */
function Section({
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div>
      <DropdownMenuItem
        closeOnClick={false}
        onClick={onToggle}
        className="gap-1 px-1.5 py-1 text-xs font-medium text-muted-foreground"
      >
        <IconChevronRight
          className={cn(
            "size-3.5 transition-transform",
            !collapsed && "rotate-90"
          )}
        />
        <span>{title}</span>
        <span className="text-muted-foreground/70">{count}</span>
      </DropdownMenuItem>
      {!collapsed && <div>{children}</div>}
    </div>
  );
}

/**
 * A collapsible folder group (the "task/" prefix). Flat when folder is null.
 * `forceOpen` (set while filtering) reveals matches without discarding the
 * user's manual toggle state.
 */
function Folder({
  folder,
  forceOpen,
  children,
}: {
  folder: string | null;
  forceOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (folder === null) return <>{children}</>;
  const expanded = open || forceOpen;
  return (
    <div>
      <DropdownMenuItem
        closeOnClick={false}
        onClick={() => setOpen((v) => !v)}
        className="gap-1.5 py-1 text-sm"
      >
        <IconChevronRight
          className={cn(
            "size-3.5 transition-transform",
            expanded && "rotate-90"
          )}
        />
        <IconFolder className="size-3.5 text-muted-foreground" />
        <span className="truncate">{folder}</span>
      </DropdownMenuItem>
      {expanded && <div className="pl-3">{children}</div>}
    </div>
  );
}
