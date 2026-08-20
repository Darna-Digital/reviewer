/**
 * The card table — the one collaboration surface read across rather than down,
 * and the one that takes the window's width.
 *
 * A column is its list's colour: a tinted ground, a bar of it along the top,
 * and a border in the same hue. That is Basecamp's card table, and the reason
 * it works is that the colour is what you navigate by once there are more
 * columns than you can read the headings of at a glance.
 *
 * Dragging is HTML5 drag-and-drop rather than a pointer-driven library, for the
 * same reason the prototype's task board used it: a card is a small thing being
 * dropped into a large one, the browser already animates that, and the
 * alternative is owning a gesture that has to be got right on every platform.
 * The drop is a single write on the card — see `moveTodo`.
 */
import { IconPlus } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState, type CSSProperties, type DragEvent } from "react";
import { nextOrder } from "@byconvo/core/collab";
import type { CollabBoardColumn, CollabTodo } from "@byconvo/core/collab";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCollabBoard, useCollabProject } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useCollabActions } from "../adapters/collab.hook.adapter";
import { projectPath, todosPath } from "../functions/collab-layout.functions";
import { CollabEmpty, CollabPanel, CollabTitle } from "./collab-column";
import { ProjectMark } from "./project-mark";
import { TodoDue } from "./todo-due";

/** The card being dragged, as the only thing the drop needs to know. */
const CARD_MIME = "application/x-byconvo-collab-todo";

function Card({
  todo,
  onDragStart,
}: {
  readonly todo: CollabTodo;
  readonly onDragStart: (event: DragEvent<HTMLElement>) => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      className={cn(
        "cursor-grab rounded-lg border bg-surface-3 px-3 py-2 shadow-surface-2 active:cursor-grabbing",
        todo.done && "opacity-60"
      )}
    >
      <p
        className={cn(
          "text-[13px] font-medium text-pretty",
          todo.done && "line-through"
        )}
      >
        {todo.title}
      </p>
      <div className="mt-1 flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
        {todo.assignee.length > 0 && (
          <span className="truncate">{todo.assignee}</span>
        )}
        <TodoDue dueOn={todo.dueOn} />
      </div>
    </article>
  );
}

function Column({
  column,
  projectId,
  todos,
}: {
  readonly column: CollabBoardColumn;
  readonly projectId: string;
  /** Every card on the board — what the drop needs to place one at the end. */
  readonly todos: ReadonlyArray<CollabTodo>;
}) {
  const actions = useCollabActions();
  const [over, setOver] = useState(false);
  const [adding, setAdding] = useState("");

  const drop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setOver(false);
    const id = event.dataTransfer.getData(CARD_MIME);
    const moved = todos.find((todo) => todo.id === id);
    // A card dropped back where it started is not a move, and writing it would
    // retire every read on the page for nothing.
    if (moved === undefined || moved.listId === column.list.id) return;
    void actions.moveTodo(
      moved,
      column.list.id,
      nextOrder(todos, column.list.id)
    );
  };

  return (
    <section
      style={{ "--tint": column.list.color } as CSSProperties}
      onDragOver={(event) => {
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border border-(--tint)/35 bg-(--tint)/8 transition-colors",
        over && "border-(--tint)/70 bg-(--tint)/15"
      )}
    >
      <header className="flex items-center gap-2 rounded-t-xl bg-(--tint)/18 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {column.list.name}
        </span>
        <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
          {column.todos.length}
        </span>
      </header>

      <div className="flex min-h-24 flex-col gap-2 p-2">
        {column.todos.map((todo) => (
          <Card
            key={todo.id}
            todo={todo}
            onDragStart={(event) => {
              event.dataTransfer.setData(CARD_MIME, todo.id);
              event.dataTransfer.effectAllowed = "move";
            }}
          />
        ))}
      </div>

      <form
        className="flex items-center gap-1 p-2 pt-0"
        onSubmit={(event) => {
          event.preventDefault();
          void actions
            .createTodo(projectId, adding, column.list.id)
            .then((created) => {
              if (created !== null) setAdding("");
            });
        }}
      >
        <Input
          value={adding}
          placeholder="Add a card"
          aria-label={`Add a card to ${column.list.name}`}
          className="h-7 bg-surface-3"
          onChange={(event) => setAdding(event.target.value)}
        />
        <Button type="submit" variant="ghost" size="icon-sm" aria-label="Add">
          <IconPlus />
        </Button>
      </form>
    </section>
  );
}

function AddColumn({ projectId }: { readonly projectId: string }) {
  const actions = useCollabActions();
  const [name, setName] = useState("");

  return (
    <form
      className="flex w-56 shrink-0 items-center gap-1 self-start rounded-xl border border-dashed p-2"
      onSubmit={(event) => {
        event.preventDefault();
        void actions.addList(projectId, name).then((updated) => {
          if (updated !== null) setName("");
        });
      }}
    >
      <Input
        value={name}
        placeholder="New column"
        aria-label="New column"
        className="h-7"
        onChange={(event) => setName(event.target.value)}
      />
      <Button type="submit" variant="ghost" size="icon-sm" aria-label="Add">
        <IconPlus />
      </Button>
    </form>
  );
}

export function BoardPage({ projectId }: { readonly projectId: string }) {
  const detail = useCollabProject(projectId);
  const board = useCollabBoard(projectId);

  if (detail.data === undefined || board.data === undefined) {
    return (
      <CollabPanel>
        <CollabEmpty>
          {detail.isPending || board.isPending ? "Loading…" : "Not here."}
        </CollabEmpty>
      </CollabPanel>
    );
  }

  const { project, todos } = detail.data;

  return (
    <>
      <CollabTitle
        eyebrow={
          <>
            <ProjectMark color={project.color} className="size-3" />
            <Link
              to={projectPath(project.id)}
              className="hover:text-foreground"
            >
              {project.name}
            </Link>
          </>
        }
        actions={
          // A link wearing the button's face rather than a button that
          // navigates: this goes somewhere, so it should open in a new tab on
          // ⌘-click and read as a destination to a screen reader.
          <Link
            to={todosPath(project.id)}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Read as a list
          </Link>
        }
      >
        Card table
      </CollabTitle>

      {/* The board scrolls sideways past the column's width rather than
          squeezing its cards: a card narrower than its own title is not a
          card you can read at a glance, which is the only thing a board is
          for. */}
      <div className="-mx-6 overflow-x-auto px-6 pb-2">
        <div className="flex items-start gap-3">
          {board.data.map((column) => (
            <Column
              key={column.list.id}
              column={column}
              projectId={project.id}
              todos={todos}
            />
          ))}
          <AddColumn projectId={project.id} />
        </div>
      </div>
    </>
  );
}
