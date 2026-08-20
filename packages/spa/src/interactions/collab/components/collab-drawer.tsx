/**
 * The drawer the hovering bar raises — the launchpad, read at the other edge.
 *
 * The launchpad slides down out of the window bar and pushes the page off the
 * bottom of the window; this comes up off the foot and pushes it off the top.
 * The mechanics are deliberately the same ones, because it is the same gesture:
 *
 * - **Pushed, not covered.** The page is moved by a transform exactly as far as
 *   the drawer is tall, so it is composited away rather than laid out again,
 *   and the window reads as having made room instead of having been replaced.
 * - **Parked, not unmounted.** Shut, the drawer stands just below the window
 *   with its rows already drawn, clipped by the shell. There is nothing to
 *   build on the frame the slide begins, which is the one frame it cannot
 *   spare — and nothing to measure, so it arrives at its full height rather
 *   than growing into it. `inert` keeps the parked rows out of the tab order.
 * - **The page stays visible under a scrim**, dimmed rather than blurred: it is
 *   still the page you were reading, and a full-surface filter on every frame
 *   of the push is what a dim costs nothing to avoid.
 * - **One slide.** Duration and curve come from `panel-slide`, which the
 *   launchpad reads too — see there for why they cannot be allowed to drift.
 *
 * There is no collapse tab on the drawer's free edge, where the launchpad has
 * one. The launchpad needs it because the bar it came out of is the window's,
 * and has other work; the drawer's own bar stands on its edge already, with the
 * shortcut that raised it lit — pressing that is the way back, and a tab a few
 * pixels under it would be a second control for the same act.
 *
 * The two differ in one other thing, and it follows from the mode rather than
 * from the gesture: the launchpad's panel is the frame's own material, because the
 * page it pushes is a sheet and the contrast is sheet-against-frame.
 * Collaboration has no sheet — its pages are drawn on the frame — so the drawer
 * is the sheet, and the contrast is the same one the other way round.
 */
import { IconPlus, IconX } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEntered, usePresence } from "@/hooks/use-presence";
import { VIEWER } from "@/interactions/collaboration/data/viewer.mock";
import { PANEL_EASE, PANEL_SLIDE, PANEL_SLIDE_MS } from "@/lib/panel-slide";
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

/**
 * Where the drawer is parked when it is shut: its own height, and then a pixel
 * more. Parked flush, a border sitting on its top edge lands exactly on the
 * clip and a fraction of it survives rounding — which is how the launchpad's
 * collapse tab came to draw a second line across the frame's own.
 */
const PARKED = "translate-y-[calc(100%+1px)]";

/** Where a bookmark leads, by what it points at. */
const bookmarkHref = (kind: string, targetId: string): string =>
  kind === "project" ? projectPath(targetId) : notesPath("");

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

/**
 * The page giving way to the drawer.
 *
 * Moved rather than resized, exactly as `TabOverviewPush` moves it for the
 * launchpad: the transform is the whole of the animation, and the column
 * underneath never learns that anything happened. The scrim is a child so it
 * travels with the page it is dimming — it covers the page, not the window.
 */
export function CollabDrawerPush({
  children,
}: {
  readonly children: ReactNode;
}) {
  const open = useCollabDrawer();
  const present = usePresence(open !== null, PANEL_SLIDE_MS);

  return (
    <div
      style={PANEL_SLIDE}
      className={cn(
        "absolute inset-0 flex min-h-0 min-w-0 flex-col",
        "transition-transform motion-reduce:transition-none",
        // Held only while the drawer is on screen: the layer is the whole page,
        // and it is not worth its memory for the rest of the session.
        present && "will-change-transform",
        open !== null && "-translate-y-[var(--collab-drawer)]",
        PANEL_EASE
      )}
    >
      {children}
    </div>
  );
}

/** The dimmed page under the drawer, and the second way out of it. */
export function CollabDrawerScrim() {
  const open = useCollabDrawer();
  const present = usePresence(open !== null, PANEL_SLIDE_MS);
  const entered = useEntered(open !== null);
  if (!present) return null;

  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label="Close the drawer"
      data-open={entered || undefined}
      style={PANEL_SLIDE}
      onClick={closeCollabDrawer}
      className="absolute inset-0 z-30 cursor-default bg-background/40 opacity-0 transition-opacity motion-reduce:transition-none data-open:opacity-100"
    />
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

  /**
   * The panel the drawer is *showing*, which is not quite the one that is open:
   * on the way out there is no open panel, and a drawer that emptied its header
   * and its rows on the frame the slide began would read as the contents being
   * taken away rather than the drawer leaving with them. So it keeps the last
   * one it was asked for, and swaps at once when it is asked for another.
   */
  const [shown, setShown] = useState<CollabPanel | null>(null);
  useEffect(() => {
    if (open !== null) setShown(open);
  }, [open]);

  const title =
    COLLAB_SHORTCUTS.find((shortcut) => shortcut.panel === shown)?.label ?? "";
  const data = mine.data;

  const body = (panel: CollabPanel): ReactNode => {
    if (data === undefined) return <CollabEmpty>Loading…</CollabEmpty>;
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
        to={notesPath(note.projectId)}
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
    <section
      aria-label={title.length > 0 ? title : "My stuff"}
      // Parked rather than hidden or emptied — see the note at the top. `inert`
      // is what keeps a parked row from being reachable by Tab; `aria-hidden`
      // is what keeps it from being read out.
      aria-hidden={open === null}
      inert={open === null}
      data-open={open !== null || undefined}
      style={{ ...PANEL_SLIDE, height: "var(--collab-drawer)" }}
      className={cn(
        // Above the scrim, which lies on the page the drawer is pushing.
        //
        // Full-bleed, as the launchpad's panel is. A sheet centred in the band
        // it opened would leave a sliver of bare frame down either side, which
        // reads as a card dropped into a gap rather than as the window having
        // made room — and making room is the whole of what the push says. Its
        // rows are centred instead, in the column the page above uses, so the
        // two line up down the same edges.
        "absolute inset-x-0 bottom-0 z-40 flex flex-col",
        "border-t bg-surface-2",
        // Kept on a layer of its own for the life of the window rather than
        // only while it is up: a layer promoted to on the way in is one the
        // window has to raster during the slide, on the frames that can least
        // afford it.
        "will-change-transform",
        "transition-transform motion-reduce:transition-none",
        "data-open:translate-y-0",
        PARKED,
        PANEL_EASE
      )}
    >
      <header className="mx-auto flex h-11 w-full max-w-3xl shrink-0 items-center gap-2 px-6">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {shown === "notes" && (
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
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-px px-3 pb-4">
          {shown === null ? null : body(shown)}
        </div>
      </ScrollArea>
    </section>
  );
}
