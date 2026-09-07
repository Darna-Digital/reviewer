/**
 * The branch switcher's full surface: the same Recent / Local / Remote model
 * and the same per-branch actions, laid out for a persistent dock or page
 * instead of squeezed into a popover.
 */
import { useState } from "react";
import {
  IconChevronRight,
  IconFolder,
  IconGitBranch,
  IconPlus,
  IconRefresh,
  IconSearch,
  IconStarFilled,
} from "@tabler/icons-react";
import {
  useBranchActionControls,
  type BranchActionControlProps,
  type BranchActionScope,
  type BranchActionTarget,
} from "@/components/layout/branch-actions";
import {
  groupBranchesByFolder,
  splitBranchFolder,
} from "@/components/layout/branch-groups";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProjectAvatar } from "@/interactions/workspace/components/project-avatar";
import { cn } from "@/lib/utils";
import type { RepoBranches } from "@reviewer/core/project";
import type { BranchInfo, RemoteBranchInfo } from "@reviewer/core/repo";
import type { RepoEntry } from "@reviewer/core/workspace";

interface VirtualAnchor {
  readonly getBoundingClientRect: () => DOMRect;
}

const pointerAnchor = (x: number, y: number): VirtualAnchor => ({
  getBoundingClientRect: () => new DOMRect(x, y, 0, 0),
});

interface BranchesPanelProps extends Omit<
  BranchActionControlProps,
  "currentRepoPath"
> {
  readonly current: string | null;
  readonly branches: ReadonlyArray<BranchInfo>;
  readonly remoteBranches: ReadonlyArray<RemoteBranchInfo>;
  readonly repos?: ReadonlyArray<RepoBranches>;
  readonly currentRepo?: RepoEntry | null;
}

export function BranchesPanel(props: BranchesPanelProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{
    readonly repoPath: string | null;
    readonly ref: string;
  } | null>(null);
  const [surfaceMenu, setSurfaceMenu] = useState<VirtualAnchor | null>(null);
  // Mirror the dropdown defaults: Recent and Local open, Remote folded away.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    recent: false,
    local: false,
    remote: true,
  });
  const currentRepoPath = props.currentRepo?.path ?? null;
  const actions = useBranchActionControls({
    ...props,
    currentRepoPath,
  });
  const currentName =
    props.current ??
    props.branches.find((branch) => branch.isCurrent)?.name ??
    "—";
  const q = query.trim().toLowerCase();
  const matches = (name: string) =>
    q.length === 0 || name.toLowerCase().includes(q);
  const multiRepo = (props.repos ?? []).length > 1;

  const sectionCollapsed = (id: string) =>
    q.length === 0 && collapsed[id] === true;
  const toggleSection = (id: string) =>
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));

  const renderSections = ({
    repoPath,
    head,
    sectionBranches,
    sectionRemotes,
    keyPrefix,
  }: BranchActionScope & {
    readonly sectionBranches: ReadonlyArray<BranchInfo>;
    readonly sectionRemotes: ReadonlyArray<RemoteBranchInfo>;
    readonly keyPrefix: string;
  }) => {
    const scope = { repoPath, head };
    const recent = sectionBranches.filter((b) => matches(b.name)).slice(0, 5);
    const localGroups = groupBranchesByFolder(
      sectionBranches.filter((b) => matches(b.name)),
      (branch) => branch.name
    );
    const remoteGroups = groupBranchesByFolder(
      sectionRemotes.filter((b) => matches(b.name)),
      (branch) => branch.name
    );
    const localCount = localGroups.reduce(
      (total, group) => total + group.items.length,
      0
    );
    const remoteCount = remoteGroups.reduce(
      (total, group) => total + group.items.length,
      0
    );

    return (
      <>
        <BranchSection
          title="Recent"
          count={recent.length}
          collapsed={sectionCollapsed(`${keyPrefix}recent`)}
          onToggle={() => toggleSection(`${keyPrefix}recent`)}
        >
          {recent.map((branch) => (
            <LocalBranchRow
              key={`recent:${branch.name}`}
              branch={branch}
              displayName={branch.name}
              scope={scope}
              actions={actions.actionItems}
              selected={
                selected?.repoPath === scope.repoPath &&
                selected.ref === branch.name
              }
              onSelect={() => setSelected({ repoPath, ref: branch.name })}
              onCheckout={(target) => actions.checkout(target, scope)}
            />
          ))}
        </BranchSection>

        <BranchSection
          title="Local"
          count={localCount}
          collapsed={sectionCollapsed(`${keyPrefix}local`)}
          onToggle={() => toggleSection(`${keyPrefix}local`)}
        >
          {localGroups.map((group) => (
            <BranchFolder
              key={`local:${group.folder ?? "_"}`}
              name={group.folder}
              forceOpen={q.length > 0}
            >
              {group.items.map((branch) => (
                <LocalBranchRow
                  key={branch.name}
                  branch={branch}
                  displayName={splitBranchFolder(branch.name)[1]}
                  scope={scope}
                  actions={actions.actionItems}
                  selected={
                    selected?.repoPath === scope.repoPath &&
                    selected.ref === branch.name
                  }
                  onSelect={() => setSelected({ repoPath, ref: branch.name })}
                  onCheckout={(target) => actions.checkout(target, scope)}
                />
              ))}
            </BranchFolder>
          ))}
        </BranchSection>

        <BranchSection
          title="Remote"
          count={remoteCount}
          collapsed={sectionCollapsed(`${keyPrefix}remote`)}
          onToggle={() => toggleSection(`${keyPrefix}remote`)}
        >
          {remoteGroups.map((group) => (
            <BranchFolder
              key={`remote:${group.folder ?? "_"}`}
              name={group.folder}
              forceOpen={q.length > 0}
            >
              {group.items.map((branch) => (
                <RemoteBranchRow
                  key={branch.name}
                  branch={branch}
                  scope={scope}
                  actions={actions.actionItems}
                  selected={
                    selected?.repoPath === scope.repoPath &&
                    selected.ref === branch.name
                  }
                  onSelect={() => setSelected({ repoPath, ref: branch.name })}
                  onCheckout={(target) => actions.checkout(target, scope)}
                />
              ))}
            </BranchFolder>
          ))}
        </BranchSection>

        {recent.length === 0 && localCount === 0 && remoteCount === 0 && (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No branches match “{query}”
          </div>
        )}
      </>
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2">
        <div className="relative min-w-40 flex-1">
          <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search branches"
            aria-label="Search branches"
            className="h-7 pl-8"
          />
        </div>
      </div>

      <ScrollArea
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade"
        onContextMenu={(event) => {
          if (event.defaultPrevented) return;
          event.preventDefault();
          setSurfaceMenu(pointerAnchor(event.clientX, event.clientY));
        }}
      >
        <div className="w-full px-2 py-2">
          {multiRepo
            ? props.repos?.map((entry) => (
                <RepositoryBranches
                  key={entry.repo.path}
                  entry={entry}
                  current={entry.repo.path === currentRepoPath}
                  forceOpen={q.length > 0}
                >
                  {renderSections({
                    repoPath: entry.repo.path,
                    head: entry.repo.branch ?? "—",
                    sectionBranches: entry.branches,
                    sectionRemotes: entry.remoteBranches,
                    keyPrefix: `${entry.repo.path}:`,
                  })}
                </RepositoryBranches>
              ))
            : renderSections({
                repoPath: null,
                head: currentName,
                sectionBranches: props.branches,
                sectionRemotes: props.remoteBranches,
                keyPrefix: "",
              })}
        </div>
      </ScrollArea>
      {surfaceMenu !== null && (
        <ContextMenu
          open
          onOpenChange={(open) => !open && setSurfaceMenu(null)}
        >
          <ContextMenuContent
            anchor={surfaceMenu}
            side="bottom"
            align="start"
            sideOffset={2}
            className="w-72"
          >
            <ContextMenuItem onClick={() => actions.createBranch(null)}>
              <IconPlus className="size-3.5 text-muted-foreground" />
              New branch…
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={props.busy}
              onClick={() => actions.fetch(null)}
            >
              <IconRefresh className="size-3.5 text-muted-foreground" />
              Update
            </ContextMenuItem>
            <ContextMenuItem
              disabled={props.busy}
              onClick={() => actions.push(null)}
            >
              Push…
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}
      {actions.dialog}
    </div>
  );
}

function BranchSection({
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  readonly title: string;
  readonly count: number;
  readonly collapsed: boolean;
  readonly onToggle: () => void;
  readonly children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="mb-1" aria-label={title}>
      <button
        type="button"
        className="flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-xs font-medium text-muted-foreground outline-none hover:bg-elevate focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <IconChevronRight
          className={cn("size-3.5 shrink-0", !collapsed && "rotate-90")}
        />
        <span>{title}</span>
        <span className="text-muted-foreground/70">{count}</span>
      </button>
      {!collapsed && (
        <div className="mt-0.5 flex flex-col gap-px">{children}</div>
      )}
    </section>
  );
}

function BranchFolder({
  name,
  forceOpen,
  children,
}: {
  readonly name: string | null;
  readonly forceOpen: boolean;
  readonly children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (name === null) return <>{children}</>;
  const expanded = open || forceOpen;
  return (
    <div>
      <button
        type="button"
        className="flex h-7 w-full items-center gap-1.5 rounded-md px-5 text-left text-sm text-muted-foreground outline-none hover:bg-elevate focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        aria-expanded={expanded}
        onClick={() => setOpen((current) => !current)}
      >
        <IconChevronRight
          className={cn("size-3.5 shrink-0", expanded && "rotate-90")}
        />
        <IconFolder className="size-3.5 shrink-0" />
        <span className="truncate">{name}</span>
      </button>
      {expanded && <div className="flex flex-col gap-px pl-6">{children}</div>}
    </div>
  );
}

function LocalBranchRow({
  branch,
  displayName,
  scope,
  actions,
  selected,
  onSelect,
  onCheckout,
}: {
  readonly branch: BranchInfo;
  readonly displayName: string;
  readonly scope: BranchActionScope;
  readonly actions: (
    target: BranchActionTarget,
    scope: BranchActionScope
  ) => React.ReactNode;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onCheckout: (target: BranchActionTarget) => void;
}) {
  return (
    <BranchRowMenu
      target={{
        display: branch.name,
        ref: branch.name,
        isCurrent: branch.isCurrent,
        isRemote: false,
      }}
      scope={scope}
      actions={actions}
      current={branch.isCurrent}
      selected={selected}
      onSelect={onSelect}
      onCheckout={onCheckout}
      icon={
        branch.isCurrent ? (
          <IconStarFilled className="size-3.5 text-amber-500" />
        ) : (
          <IconGitBranch className="size-3.5 text-muted-foreground" />
        )
      }
      label={displayName}
      suffix={
        branch.ahead > 0 || branch.behind > 0 ? (
          <span className="flex items-center gap-1 text-xs tabular-nums">
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
        ) : undefined
      }
    />
  );
}

function RemoteBranchRow({
  branch,
  scope,
  actions,
  selected,
  onSelect,
  onCheckout,
}: {
  readonly branch: RemoteBranchInfo;
  readonly scope: BranchActionScope;
  readonly actions: (
    target: BranchActionTarget,
    scope: BranchActionScope
  ) => React.ReactNode;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onCheckout: (target: BranchActionTarget) => void;
}) {
  return (
    <BranchRowMenu
      target={{
        display: branch.name,
        ref: branch.shortName,
        isCurrent: false,
        isRemote: true,
      }}
      scope={scope}
      actions={actions}
      selected={selected}
      onSelect={onSelect}
      onCheckout={onCheckout}
      icon={<IconGitBranch className="size-3.5 text-muted-foreground" />}
      label={splitBranchFolder(branch.name)[1]}
      suffix={
        <span className="text-xs text-muted-foreground">{branch.remote}</span>
      }
    />
  );
}

function BranchRowMenu({
  target,
  scope,
  actions,
  current = false,
  selected,
  onSelect,
  onCheckout,
  icon,
  label,
  suffix,
}: {
  readonly target: BranchActionTarget;
  readonly scope: BranchActionScope;
  readonly actions: (
    target: BranchActionTarget,
    scope: BranchActionScope
  ) => React.ReactNode;
  readonly current?: boolean;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly onCheckout: (target: BranchActionTarget) => void;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly suffix?: React.ReactNode;
}) {
  const [anchor, setAnchor] = useState<VirtualAnchor | null>(null);
  const openAt = (x: number, y: number) => setAnchor(pointerAnchor(x, y));

  return (
    <>
      <button
        type="button"
        className={cn(
          "flex h-7 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-elevate focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
          current && "font-medium",
          (selected || current) && "bg-elevate"
        )}
        aria-pressed={selected}
        aria-current={current ? "true" : undefined}
        title={`${target.display} — double-click to check out; right-click for actions`}
        onClick={onSelect}
        onDoubleClick={() => {
          if (!target.isCurrent) onCheckout(target);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onSelect();
          openAt(event.clientX, event.clientY);
        }}
        onKeyDown={(event) => {
          if (
            event.key !== "ContextMenu" &&
            !(event.shiftKey && event.key === "F10")
          ) {
            return;
          }
          event.preventDefault();
          onSelect();
          const rect = event.currentTarget.getBoundingClientRect();
          openAt(rect.left + 16, rect.bottom);
        }}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {suffix}
      </button>
      {anchor !== null && (
        <ContextMenu open onOpenChange={(open) => !open && setAnchor(null)}>
          <ContextMenuContent
            anchor={anchor}
            side="bottom"
            align="start"
            sideOffset={2}
            className="w-72"
          >
            {actions(target, scope)}
          </ContextMenuContent>
        </ContextMenu>
      )}
    </>
  );
}

function RepositoryBranches({
  entry,
  current,
  forceOpen,
  children,
}: {
  readonly entry: RepoBranches;
  readonly current: boolean;
  readonly forceOpen: boolean;
  readonly children: React.ReactNode;
}) {
  const [open, setOpen] = useState(current);
  const expanded = open || forceOpen;
  return (
    <section className="mb-2 rounded-lg border bg-muted/20 p-1">
      <button
        type="button"
        className="flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm outline-none hover:bg-elevate focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        aria-expanded={expanded}
        onClick={() => setOpen((value) => !value)}
      >
        <IconChevronRight
          className={cn("size-3.5 shrink-0", expanded && "rotate-90")}
        />
        <ProjectAvatar name={entry.repo.name} className="size-4" />
        <span
          className={cn("min-w-0 flex-1 truncate", current && "font-medium")}
        >
          {entry.repo.name}
        </span>
        <span className="max-w-[50%] shrink-0 truncate text-xs text-muted-foreground">
          {entry.repo.branch ?? "detached"}
        </span>
      </button>
      {expanded && <div className="pt-1">{children}</div>}
    </section>
  );
}
