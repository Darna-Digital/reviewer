/**
 * LocalDevPage — JetBrains-style run configurations for the open project.
 * The left sidebar lists the project's git roots as accordions, each holding
 * the commands that run in it (e.g. `pnpm dev` in `web`, `pnpm serve` in
 * `api`), with live status and per-row run/stop; the body shows the selected
 * command's terminal. Commands can be started/stopped one at a time, a
 * repository at a time, or across the whole project, and the processes keep
 * running on the server while you browse other pages (they stop only when you
 * open a different project). Definitions are CRUD-managed via a small dialog,
 * and each is stored in the repository it runs in.
 */
import {
  IconChevronRight,
  IconPencil,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  cloneElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactElement,
} from "react";
import { toast } from "sonner";
import { SidebarResizeHandle } from "@/components/layout/sidebar-resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { DevTerminal } from "@/interactions/local-dev/components/dev-terminal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocalDevActions } from "@/interactions/local-dev/adapters/local-dev.hook.adapter";
import type { DevCommandView } from "@reviewer/core/local-dev";
import type { RepoEntry } from "@reviewer/core/workspace";
import { useDevCommands, useWorkspace } from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

interface Draft {
  id: string | null;
  name: string;
  command: string;
  repoPath: string;
}

interface RepoGroup {
  repo: RepoEntry;
  commands: ReadonlyArray<DevCommandView>;
}

const statusLabel = (c: DevCommandView): string => {
  if (c.status === "running") return "running";
  if (c.status === "exited")
    return c.exitCode !== null && c.exitCode !== 0
      ? `exited (${c.exitCode})`
      : "exited";
  return "stopped";
};

function StatusDot({ command }: { command: DevCommandView }) {
  const cls =
    command.status === "running"
      ? "bg-emerald-500"
      : command.status === "exited"
        ? command.exitCode !== null && command.exitCode !== 0
          ? "bg-red-500"
          : "bg-muted-foreground/50"
        : "border border-muted-foreground/40";
  return (
    <span
      className={cn("size-2 shrink-0 rounded-full", cls)}
      aria-label={statusLabel(command)}
    />
  );
}

export function LocalDevPage() {
  const commands = useDevCommands();
  const workspace = useWorkspace();
  const actions = useLocalDevActions();
  const prefs = useUiPrefs();

  const items = useMemo(() => commands.data ?? [], [commands.data]);
  const repos = useMemo(
    () => workspace.data?.repos ?? [],
    [workspace.data?.repos]
  );

  /**
   * One group per root the project holds, in the workspace's order — a root
   * with no commands keeps its place rather than disappearing, so adding the
   * first one to it is a click away. A command whose root has gone (a repo
   * removed while it ran) still lists, under the root it names.
   */
  const groups = useMemo<ReadonlyArray<RepoGroup>>(() => {
    const known = new Set(repos.map((r) => r.path));
    const orphans = items.filter((c) => !known.has(c.repoPath));
    const orphanRepos = [...new Set(orphans.map((c) => c.repoPath))].map(
      (path): RepoEntry => ({
        name: orphans.find((c) => c.repoPath === path)?.repo ?? path,
        path,
        branch: null,
      })
    );
    return [...repos, ...orphanRepos].map((repo) => ({
      repo,
      commands: items.filter((c) => c.repoPath === repo.path),
    }));
  }, [items, repos]);

  // Not React state — see `usePanelSize`.
  const sidebar = usePanelSize(
    "workspace-sidebar-w",
    prefs.workspaceSidebarWidth,
    "width"
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [draft, setDraft] = useState<Draft | null>(null);

  // The dialog fades out after the draft is cleared, so it renders one more
  // time with nothing to show — keep the last draft for that frame, or a
  // half-closed "New command" dialog relabels itself "Edit"/"Save" on the way out.
  const lastDraft = useRef<Draft | null>(null);
  if (draft !== null) lastDraft.current = draft;
  const form = draft ?? lastDraft.current;

  // Keep a valid selection as the list loads/changes.
  useEffect(() => {
    if (items.length === 0) setActiveId(null);
    else if (!items.some((c) => c.id === activeId)) setActiveId(items[0].id);
  }, [items, activeId]);

  const active = items.find((c) => c.id === activeId) ?? null;

  const toggleRepo = (path: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const guard = async (action: () => Promise<unknown>, fallback: string) => {
    try {
      await action();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fallback);
    }
  };

  const run = (id: string) => {
    setActiveId(id);
    void guard(() => actions.start(id), "could not start command");
  };
  const stop = (id: string) =>
    void guard(() => actions.stop(id), "could not stop command");
  const runAll = (repoPath?: string) =>
    void guard(async () => {
      await actions.startAll(repoPath);
      const started = items.filter(
        (c) => repoPath === undefined || c.repoPath === repoPath
      );
      if (started.length > 0) setActiveId(started[0].id);
    }, "could not start commands");
  const stopAll = (repoPath?: string) =>
    void guard(() => actions.stopAll(repoPath), "could not stop commands");

  const removeCommand = (id: string) =>
    void guard(async () => {
      if (activeId === id) {
        const next = items.find((c) => c.id !== id);
        setActiveId(next?.id ?? null);
      }
      await actions.remove(id);
    }, "could not delete command");

  const saveDraft = () =>
    void guard(async () => {
      if (draft === null) return;
      const result =
        draft.id === null
          ? await actions.create(draft.name, draft.command, draft.repoPath)
          : await actions.update(
              draft.id,
              draft.name,
              draft.command,
              draft.repoPath
            );
      if (result === null) {
        toast.error("Enter a command to run");
        return;
      }
      if (draft.id === null) setActiveId(result.id);
      setDraft(null);
    }, "could not save command");

  const newCommand = (repoPath: string) =>
    setDraft({ id: null, name: "", command: "", repoPath });

  const editCommand = (c: DevCommandView) =>
    setDraft({
      id: c.id,
      name: c.name,
      command: c.command,
      repoPath: c.repoPath,
    });

  return (
    <div className="flex h-full min-h-0">
      {/* Command list, grouped by repository (drag-resizable) */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r",
          !prefs.sidebarVisible && "hidden"
        )}
        style={sidebar.style}
      >
        {/* The dock's band, worn the way the sessions list next door wears it:
            36px with a 4px margin round its 28px controls, closed by the same
            hairline, and the title carrying the 10px inside itself that puts it
            in the column the tabs' icons stand in. */}
        <div className="flex h-9 shrink-0 items-center justify-between gap-1.5 border-b px-1">
          <span className="px-2.5 text-sm font-medium">Services</span>
          <div className="flex items-center gap-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Run all"
              title="Run all"
              disabled={items.length === 0}
              onClick={() => runAll()}
            >
              <IconPlayerPlayFilled className="size-4 text-emerald-600" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="Stop all"
              title="Stop all"
              disabled={items.length === 0}
              onClick={() => stopAll()}
            >
              <IconPlayerStopFilled className="size-4" />
            </Button>
            <NewCommandMenu
              repos={repos}
              onPick={newCommand}
              button={
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label="New command"
                  title="New command"
                >
                  <IconPlus className="size-4" />
                </Button>
              }
            />
          </div>
        </div>
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="scroll-fade px-1 pb-2"
        >
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No repositories in this project yet.
            </p>
          ) : (
            groups.map((group) => (
              <RepoAccordion
                key={group.repo.path}
                group={group}
                activeId={activeId}
                open={!collapsed.has(group.repo.path)}
                onToggle={() => toggleRepo(group.repo.path)}
                onSelect={setActiveId}
                onRun={run}
                onStop={stop}
                onRunAll={() => runAll(group.repo.path)}
                onStopAll={() => stopAll(group.repo.path)}
                onNew={() => newCommand(group.repo.path)}
                onEdit={editCommand}
                onDelete={removeCommand}
              />
            ))
          )}
        </ScrollArea>
      </aside>
      {prefs.sidebarVisible && (
        <SidebarResizeHandle
          width={sidebar.current}
          stored={prefs.workspaceSidebarWidth}
          max={() => Math.max(240, window.innerWidth - 480)}
          onResize={sidebar.onResize}
          onResizeEnd={(w) => setUiPrefs({ workspaceSidebarWidth: w })}
        />
      )}

      {/* Panel body — the selected command's terminal */}
      <section className="flex min-w-0 flex-1 flex-col">
        {active === null ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm">
            <div className="font-medium">No dev command selected</div>
            <div className="text-muted-foreground">
              Add a command (e.g. <span className="font-mono">pnpm dev</span>)
              to one of the project's repositories.
            </div>
            <NewCommandMenu
              repos={repos}
              onPick={newCommand}
              button={
                <Button size="sm" variant="outline" className="mt-1">
                  <IconPlus className="size-4" /> New command
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b px-3 py-1.5">
              <StatusDot command={active} />
              <span className="shrink-0 text-xs text-muted-foreground">
                {active.repo}
              </span>
              <span className="truncate text-sm font-medium">
                {active.name}
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {active.command}
              </span>
              <span className="ml-1 shrink-0 text-xs text-muted-foreground">
                · {statusLabel(active)}
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                {active.status === "running" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => stop(active.id)}
                  >
                    <IconPlayerStopFilled className="size-4" /> Stop
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => run(active.id)}
                  >
                    <IconPlayerPlayFilled className="size-4" /> Run
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label="Edit command"
                  onClick={() => editCommand(active)}
                >
                  <IconPencil className="size-4" />
                </Button>
              </div>
            </header>

            <div className="relative min-h-0 flex-1 p-1">
              {active.status === "stopped" ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-sm">
                  <div className="text-muted-foreground">Not running</div>
                  <Button size="sm" onClick={() => run(active.id)}>
                    <IconPlayerPlayFilled className="size-4" /> Run
                  </Button>
                </div>
              ) : (
                <DevTerminal
                  key={active.id}
                  commandId={active.id}
                  active
                  resolvedTheme={prefs.resolvedTheme}
                  onExit={() => void commands.refetch()}
                />
              )}
            </div>
          </>
        )}
      </section>

      <Dialog
        open={draft !== null}
        onOpenChange={(open: boolean) => {
          if (!open) setDraft(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form?.id === null ? "New dev command" : "Edit dev command"}
            </DialogTitle>
            <DialogDescription>
              Runs from the chosen repository's root.
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
                autoFocus
                value={form?.name ?? ""}
                placeholder="Web server"
                onChange={(e) =>
                  setDraft((d) =>
                    d === null ? d : { ...d, name: e.target.value }
                  )
                }
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Command</span>
              <Input
                value={form?.command ?? ""}
                placeholder="pnpm dev"
                className="font-mono"
                onChange={(e) =>
                  setDraft((d) =>
                    d === null ? d : { ...d, command: e.target.value }
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    saveDraft();
                  }
                }}
              />
            </label>
            {repos.length > 1 && (
              <div className="grid min-w-0 gap-1 text-sm">
                <span className="text-muted-foreground">Repository</span>
                <Select
                  value={form?.repoPath ?? ""}
                  onValueChange={(value: string | null) =>
                    setDraft((d) =>
                      d === null || value === null || value === ""
                        ? d
                        : { ...d, repoPath: value }
                    )
                  }
                >
                  <SelectTrigger
                    className="w-full min-w-0"
                    aria-label="Repository"
                  >
                    {/* The value is a root's absolute path; show its name. */}
                    <SelectValue className="truncate">
                      {(value: string | null) =>
                        repos.find((repo) => repo.path === value)?.name ?? value
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {repos.map((repo) => (
                      <SelectItem key={repo.path} value={repo.path}>
                        {repo.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={saveDraft}>
              {form?.id === null ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface NewCommandMenuProps {
  repos: ReadonlyArray<RepoEntry>;
  onPick: (repoPath: string) => void;
  /** The button that opens it, styled by the surface it sits on. */
  button: ReactElement<ComponentProps<typeof Button>>;
}

/**
 * Which repository a new command lands in, asked rather than assumed — the
 * project-level button has no repository of its own to fall back on. A project
 * holding one root has nothing to choose, so there the button simply creates.
 */
function NewCommandMenu({ repos, onPick, button }: NewCommandMenuProps) {
  if (repos.length < 2) {
    const only = repos[0]?.path;
    return cloneElement(button, {
      disabled: only === undefined,
      onClick: () => only !== undefined && onPick(only),
    });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={button} />
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>New command in</DropdownMenuLabel>
          {repos.map((repo) => (
            <DropdownMenuItem key={repo.path} onClick={() => onPick(repo.path)}>
              {repo.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A repository row's action: a hit target of its own, revealed on hover. */
const REPO_ACTION =
  "grid size-5 shrink-0 place-items-center rounded-md opacity-0 outline-none transition-opacity group-hover/repo:opacity-100 hover:bg-elevate focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-0";

interface RepoAccordionProps {
  group: RepoGroup;
  activeId: string | null;
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onRun: (id: string) => void;
  onStop: (id: string) => void;
  onRunAll: () => void;
  onStopAll: () => void;
  onNew: () => void;
  onEdit: (command: DevCommandView) => void;
  onDelete: (id: string) => void;
}

/** One of the project's repositories and the services it runs. */
function RepoAccordion({
  group,
  activeId,
  open,
  onToggle,
  onSelect,
  onRun,
  onStop,
  onRunAll,
  onStopAll,
  onNew,
  onEdit,
  onDelete,
}: RepoAccordionProps) {
  const running = group.commands.filter((c) => c.status === "running").length;
  return (
    <section className="mb-1">
      <div className="group/repo mb-0.5 flex items-center gap-1 rounded-md px-1 py-1 hover:bg-muted/60">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${group.repo.name}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none"
        >
          <IconChevronRight
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform duration-100",
              open && "rotate-90"
            )}
          />
          <span className="truncate text-xs font-medium">
            {group.repo.name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {running > 0 ? `${running} running` : group.commands.length}
          </span>
        </button>
        <button
          type="button"
          aria-label={`Run all in ${group.repo.name}`}
          title="Run all in this repository"
          className={cn(REPO_ACTION, "text-emerald-600 hover:text-emerald-500")}
          disabled={group.commands.length === 0}
          onClick={onRunAll}
        >
          <IconPlayerPlayFilled className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`Stop all in ${group.repo.name}`}
          title="Stop all in this repository"
          className={cn(
            REPO_ACTION,
            "text-muted-foreground hover:text-foreground"
          )}
          disabled={running === 0}
          onClick={onStopAll}
        >
          <IconPlayerStopFilled className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={`New command in ${group.repo.name}`}
          title="New command in this repository"
          className={cn(
            REPO_ACTION,
            "text-muted-foreground hover:text-foreground"
          )}
          onClick={onNew}
        >
          <IconPlus className="size-3.5" />
        </button>
      </div>
      {open &&
        (group.commands.length === 0 ? (
          <button
            type="button"
            className="ml-5 block px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={onNew}
          >
            No commands — add one
          </button>
        ) : (
          group.commands.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group/row mb-0.5 ml-5 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
                c.id === activeId && "bg-muted"
              )}
              onClick={() => onSelect(c.id)}
              onDoubleClick={() => onEdit(c)}
              title="Double-click to edit"
            >
              <StatusDot command={c} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.name}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">
                  {c.command}
                </div>
              </div>
              {c.status === "running" ? (
                <button
                  type="button"
                  aria-label="Stop"
                  title="Stop"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStop(c.id);
                  }}
                >
                  <IconPlayerStopFilled className="size-4" />
                </button>
              ) : (
                <button
                  type="button"
                  aria-label="Run"
                  title="Run"
                  className="shrink-0 text-emerald-600 hover:text-emerald-500"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRun(c.id);
                  }}
                >
                  <IconPlayerPlayFilled className="size-4" />
                </button>
              )}
              <button
                type="button"
                aria-label="Edit"
                title="Edit"
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(c);
                }}
              >
                <IconPencil className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Delete"
                title="Delete"
                className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
              >
                <IconTrash className="size-3.5" />
              </button>
            </div>
          ))
        ))}
    </section>
  );
}
