/**
 * LocalDevPage — JetBrains-style run configurations for the open repository.
 * The left sidebar lists its commands (e.g. `pnpm dev`) with live status and
 * per-row run/stop; the body shows the selected command's terminal. Commands
 * can be started/stopped one at a time or all at once, and the processes keep
 * running on the server while you browse other pages (they stop only when you
 * open a different repository). Definitions are CRUD-managed via a small
 * dialog — name, command, and the folder inside the repository it runs from,
 * picked from the folders the files sit in, so a monorepo's packages each get
 * their own — and stored with the repository they run in.
 */
import {
  IconFolder,
  IconPencil,
  IconPlayerPlayFilled,
  IconPlayerStopFilled,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SidebarResizeHandle } from "@/components/layout/sidebar-resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { DevTerminal } from "@/interactions/local-dev/components/dev-terminal";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocalDevActions } from "@/interactions/local-dev/adapters/local-dev.hook.adapter";
import { repoFolders } from "@/interactions/local-dev/functions/local-dev.functions";
import type { DevCommandView } from "@reviewer/core/local-dev";
import { useDevCommands, useFiles } from "@/lib/queries";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

interface Draft {
  id: string | null;
  name: string;
  command: string;
  cwd: string;
}

const folderLabel = (cwd: string): string =>
  cwd === "" ? "Repository root" : cwd;

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
  const files = useFiles();
  const actions = useLocalDevActions();
  const prefs = useUiPrefs();

  const items = useMemo(() => commands.data ?? [], [commands.data]);
  const folders = useMemo(
    () => repoFolders(files.data?.paths ?? []),
    [files.data?.paths]
  );

  // Not React state — see `usePanelSize`.
  const sidebar = usePanelSize(
    "workspace-sidebar-w",
    prefs.workspaceSidebarWidth,
    "width"
  );
  const [activeId, setActiveId] = useState<string | null>(null);
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
  const runAll = () =>
    void guard(async () => {
      await actions.startAll();
      if (items.length > 0) setActiveId(items[0].id);
    }, "could not start commands");
  const stopAll = () =>
    void guard(() => actions.stopAll(), "could not stop commands");

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
          ? await actions.create(draft)
          : await actions.update(draft.id, draft);
      if (result === null) {
        toast.error("Enter a command to run");
        return;
      }
      if (draft.id === null) setActiveId(result.id);
      setDraft(null);
    }, "could not save command");

  const newCommand = () =>
    setDraft({ id: null, name: "", command: "", cwd: "" });

  const editCommand = (c: DevCommandView) =>
    setDraft({ id: c.id, name: c.name, command: c.command, cwd: c.cwd });

  return (
    <div className="flex h-full min-h-0">
      {/* Command list (drag-resizable) */}
      <aside
        className={cn(
          "flex shrink-0 flex-col border-r",
          !prefs.sidebarVisible && "hidden"
        )}
        style={sidebar.style}
      >
        <div className="flex items-center justify-between gap-1 px-3 py-2">
          <span className="text-sm font-medium">Services</span>
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
            <Button
              size="icon"
              variant="ghost"
              className="size-7"
              aria-label="New command"
              title="New command"
              onClick={newCommand}
            >
              <IconPlus className="size-4" />
            </Button>
          </div>
        </div>
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="scroll-fade px-1 pb-2"
        >
          <CommandList
            commands={items}
            activeId={activeId}
            onSelect={setActiveId}
            onRun={run}
            onStop={stop}
            onNew={newCommand}
            onEdit={editCommand}
            onDelete={removeCommand}
          />
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
              to run in this repository.
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              onClick={newCommand}
            >
              <IconPlus className="size-4" /> New command
            </Button>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b px-3 py-1.5">
              <StatusDot command={active} />
              <span className="truncate text-sm font-medium">
                {active.name}
              </span>
              <span className="truncate font-mono text-xs text-muted-foreground">
                {active.command}
              </span>
              {active.cwd !== "" && (
                <span
                  className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
                  title={`Runs in ${active.cwd}`}
                >
                  <IconFolder className="size-3.5 shrink-0" />
                  <span className="truncate">{active.cwd}</span>
                </span>
              )}
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
              A process the server keeps running in this repository while you
              work.
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
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Folder</span>
              <Combobox<string>
                value={form?.cwd ?? ""}
                items={folders}
                onValueChange={(value) => {
                  if (value !== null)
                    setDraft((d) => (d === null ? d : { ...d, cwd: value }));
                }}
              >
                <ComboboxTrigger className="w-full" aria-label="Folder">
                  <IconFolder className="size-4 shrink-0 text-muted-foreground" />
                  <ComboboxValue>
                    {(value: string) => folderLabel(value)}
                  </ComboboxValue>
                </ComboboxTrigger>
                <ComboboxContent>
                  <ComboboxInput placeholder="Search folders…" />
                  <ComboboxEmpty>No folders found.</ComboboxEmpty>
                  <ComboboxList>
                    {(folder: string) => (
                      <ComboboxItem key={folder} value={folder}>
                        {folderLabel(folder)}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </label>
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

interface CommandListProps {
  commands: ReadonlyArray<DevCommandView>;
  activeId: string | null;
  onSelect: (id: string) => void;
  onRun: (id: string) => void;
  onStop: (id: string) => void;
  onNew: () => void;
  onEdit: (command: DevCommandView) => void;
  onDelete: (id: string) => void;
}

/** The repository's commands, one row each with its status and actions. */
function CommandList({
  commands,
  activeId,
  onSelect,
  onRun,
  onStop,
  onNew,
  onEdit,
  onDelete,
}: CommandListProps) {
  if (commands.length === 0) {
    return (
      <button
        type="button"
        className="block px-3 py-6 text-center text-xs text-muted-foreground hover:text-foreground"
        onClick={onNew}
      >
        No commands — add one
      </button>
    );
  }
  return (
    <>
      {commands.map((c) => (
        <div
          key={c.id}
          className={cn(
            "group/row mb-0.5 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted",
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
              {c.cwd !== "" && (
                <span className="font-sans" title={`Runs in ${c.cwd}`}>
                  {c.cwd} ·{" "}
                </span>
              )}
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
      ))}
    </>
  );
}
