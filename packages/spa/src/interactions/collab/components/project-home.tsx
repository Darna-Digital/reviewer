/**
 * A project's own page: its name, what it is about, and its tools laid out as
 * previews you can read without opening any of them.
 *
 * This is the shape Basecamp's project page has, and the reason for it is that
 * a project is not a list of anything — it is a handful of different kinds of
 * thing kept together. So each tool gets a panel showing enough of itself to
 * answer the question you would have opened it to ask, and the panel is the way
 * in rather than a link beside one.
 */
import { IconBookmark, IconBookmarkFilled } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { isBookmarked, board as dealBoard } from "@byconvo/core/collab";
import { Button } from "@/components/ui/button";
import { VIEWER } from "@/interactions/collaboration/data/viewer.mock";
import { useCollabMine, useCollabProject } from "@/lib/queries";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { useCollabActions } from "../adapters/collab.hook.adapter";
import {
  boardPath,
  COLLAB_PATH,
  notesPath,
  todosPath,
} from "../functions/collab-layout.functions";
import {
  CollabEmpty,
  CollabPanel,
  CollabSectionHeading,
  CollabTitle,
} from "./collab-column";
import { ProjectMark } from "./project-mark";
import { TodoDue } from "./todo-due";

/** One tool: its warm label, and the sheet you press to go into it. */
function Tool({
  title,
  to,
  children,
}: {
  readonly title: string;
  readonly to: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="min-w-0">
      <CollabSectionHeading>{title}</CollabSectionHeading>
      <Link
        to={to}
        className="block rounded-xl border bg-surface-2 shadow-surface-2 transition-colors outline-none hover:bg-elevate focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        {children}
      </Link>
    </section>
  );
}

export function ProjectHome({ projectId }: { readonly projectId: string }) {
  const detail = useCollabProject(projectId);
  const mine = useCollabMine(VIEWER.name);
  const actions = useCollabActions();

  if (detail.isPending) {
    return (
      <CollabPanel>
        <CollabEmpty>Loading…</CollabEmpty>
      </CollabPanel>
    );
  }
  if (detail.data === undefined) {
    return (
      <CollabPanel>
        <CollabEmpty>
          That project is not here.{" "}
          <Link to={COLLAB_PATH} className="text-link hover:underline">
            Back to projects
          </Link>
          .
        </CollabEmpty>
      </CollabPanel>
    );
  }

  const { project, todos, notes } = detail.data;
  const bookmarks = mine.data?.bookmarks ?? [];
  const starred = isBookmarked(bookmarks, "project", project.id);
  const columns = dealBoard(project, todos);
  const open = todos.filter((todo) => !todo.done);

  return (
    <>
      <CollabTitle
        eyebrow={
          <>
            <ProjectMark color={project.color} className="size-3" />
            <Link to={COLLAB_PATH} className="hover:text-foreground">
              Projects
            </Link>
          </>
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={starred}
            onClick={() =>
              void actions.toggleBookmark(
                bookmarks,
                "project",
                project.id,
                project.name
              )
            }
          >
            {starred ? (
              <IconBookmarkFilled data-icon="inline-start" />
            ) : (
              <IconBookmark data-icon="inline-start" />
            )}
            {starred ? "Bookmarked" : "Bookmark"}
          </Button>
        }
      >
        {project.name}
      </CollabTitle>

      {project.purpose.length > 0 && (
        <p className="-mt-3 mb-7 text-[15px] text-pretty text-muted-foreground">
          {project.purpose}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Tool title="To-dos" to={todosPath(project.id)}>
          {open.length === 0 ? (
            <CollabEmpty>Nothing outstanding.</CollabEmpty>
          ) : (
            <ul className="flex flex-col gap-1.5 p-4">
              {open.slice(0, 6).map((todo) => (
                <li
                  key={todo.id}
                  className="flex min-w-0 items-center gap-2 text-[13px]"
                >
                  <span
                    aria-hidden
                    className="size-3.5 shrink-0 rounded-[0.25rem] border"
                  />
                  <span className="min-w-0 flex-1 truncate">{todo.title}</span>
                  <TodoDue dueOn={todo.dueOn} />
                </li>
              ))}
              {open.length > 6 && (
                <li className="pt-1 text-[0.6875rem] text-muted-foreground">
                  and {open.length - 6} more
                </li>
              )}
            </ul>
          )}
        </Tool>

        {/* The board, as the shape it is rather than as its contents: the
            columns and their counts are what you would have opened it to see
            from here, and a card is too small to read at this size anyway. */}
        <Tool title="Card table" to={boardPath(project.id)}>
          <div className="flex gap-1.5 p-4">
            {columns.map((column) => (
              <div
                key={column.list.id}
                style={{ "--tint": column.list.color } as React.CSSProperties}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-lg border border-(--tint)/35 bg-(--tint)/10 px-1.5 py-3"
                )}
              >
                <span className="text-sm font-semibold tabular-nums">
                  {column.todos.length}
                </span>
                <span className="w-full truncate text-center text-[0.625rem] text-muted-foreground">
                  {column.list.name}
                </span>
              </div>
            ))}
          </div>
        </Tool>

        <Tool title="Notes" to={notesPath(project.id)}>
          {notes.length === 0 ? (
            <CollabEmpty>No notes on this project yet.</CollabEmpty>
          ) : (
            <ul className="flex flex-col gap-1.5 p-4">
              {notes.slice(0, 5).map((note) => (
                <li
                  key={note.id}
                  className="flex min-w-0 items-center gap-2 text-[13px]"
                >
                  <span className="min-w-0 flex-1 truncate">{note.title}</span>
                  <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
                    {timeAgo(note.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Tool>
      </div>
    </>
  );
}
