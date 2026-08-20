/**
 * The drawer the hovering bar raises — the launchpad's idea, at the other edge.
 *
 * The launchpad slides down out of the window bar and pushes the page off the
 * bottom; this comes up from the foot and lets the page stay where it is, which
 * is the difference between going somewhere and glancing at something. You look
 * into it, take a thing out of it or write one into it, and it goes.
 *
 * It is one sheet showing one of three lists rather than three sheets: crossing
 * from tasks to notes changes what is in it without the sheet itself moving,
 * because the sheet is not what you asked for either time.
 */
import { IconPlus, IconX } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { VIEWER } from "@/interactions/collaboration/data/viewer.mock";
import { useCollabMine } from "@/lib/queries";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import type { CollabPanel } from "../interfaces/collab.interfaces";
import {
  COLLAB_SHORTCUTS,
  notesPath,
  projectPath,
} from "../functions/collab-layout.functions";
import {
  closeCollabDrawer,
  useCollabDrawer,
} from "../adapters/collab-drawer.store";
import { useCollabActions } from "../adapters/collab.hook.adapter";
import { CollabEmpty } from "./collab-column";
import { TodoDue } from "./todo-due";

/** Where a bookmark leads, by what it points at. */
const bookmarkHref = (kind: string, targetId: string): string =>
  kind === "project" ? projectPath(targetId) : `${notesPath("")}`;

function Row({
  to,
  children,
  onNavigate,
}: {
  readonly to: string;
  readonly children: ReactNode;
  readonly onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] outline-none hover:bg-elevate focus-visible:bg-elevate focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      {children}
    </Link>
  );
}

export function CollabDrawer() {
  const open = useCollabDrawer();
  const mine = useCollabMine(VIEWER.name);
  const actions = useCollabActions();

  // Escape shuts it, wherever the focus is: it is a glance, and a glance ends
  // the moment you ask it to.
  useEffect(() => {
    if (open === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCollabDrawer();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const title =
    COLLAB_SHORTCUTS.find((shortcut) => shortcut.panel === open)?.label ?? "";

  const data = mine.data;

  const body = (panel: CollabPanel): ReactNode => {
    if (data === undefined) {
      return <CollabEmpty>Loading…</CollabEmpty>;
    }
    if (panel === "tasks") {
      if (data.todos.length === 0) {
        return <CollabEmpty>Nothing is on you right now.</CollabEmpty>;
      }
      return data.todos.map((todo) => (
        <Row
          key={todo.id}
          to={projectPath(todo.projectId)}
          onNavigate={closeCollabDrawer}
        >
          <span className="min-w-0 flex-1 truncate">{todo.title}</span>
          <TodoDue dueOn={todo.dueOn} />
        </Row>
      ));
    }
    if (panel === "bookmarks") {
      if (data.bookmarks.length === 0) {
        return (
          <CollabEmpty>
            Nothing bookmarked yet — star a project to keep it here.
          </CollabEmpty>
        );
      }
      return data.bookmarks.map((bookmark) => (
        <Row
          key={bookmark.id}
          to={bookmarkHref(bookmark.kind, bookmark.targetId)}
          onNavigate={closeCollabDrawer}
        >
          <span className="min-w-0 flex-1 truncate">{bookmark.label}</span>
          <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
            {bookmark.kind}
          </span>
        </Row>
      ));
    }
    if (data.notes.length === 0) {
      return <CollabEmpty>No notes yet. Start one above.</CollabEmpty>;
    }
    return data.notes.map((note) => (
      <Row
        key={note.id}
        to={
          note.projectId.length > 0
            ? `${notesPath(note.projectId)}?note=${note.id}`
            : `${notesPath("")}?note=${note.id}`
        }
        onNavigate={closeCollabDrawer}
      >
        <span className="min-w-0 flex-1 truncate">{note.title}</span>
        <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
          {timeAgo(note.updatedAt)}
        </span>
      </Row>
    ));
  };

  return (
    <div
      // Kept mounted and slid out of sight: the panel is opened and shut often
      // enough that rebuilding its list every time would be the wait.
      aria-hidden={open === null}
      className={cn(
        // Absolute within the shell rather than fixed to the viewport: the
        // window frame insets the canvas and rounds its corners, and a sheet
        // laid on the viewport hangs past that edge and is clipped by it.
        "absolute inset-x-0 bottom-0 z-20 flex justify-center transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        open === null && "pointer-events-none translate-y-full"
      )}
    >
      <section
        aria-label={title}
        style={{ height: "var(--collab-drawer)" }}
        className="flex w-full max-w-3xl flex-col rounded-t-2xl border border-b-0 bg-surface-3 shadow-surface-6"
      >
        <header className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          {open === "notes" && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => void actions.createNote("", "")}
            >
              <IconPlus data-icon="inline-start" />
              New note
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Close"
            className="ml-auto"
            onClick={closeCollabDrawer}
          >
            <IconX />
          </Button>
        </header>
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-px p-2">
            {open === null ? null : body(open)}
          </div>
        </ScrollArea>
      </section>
    </div>
  );
}
