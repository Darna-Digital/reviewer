/**
 * A project's to-dos, read down.
 *
 * The same rows the board deals into columns, grouped by the list they are in
 * and laid out as things you tick off — which is what a to-do is when you are
 * not moving it. Ticking one here files it under the project's last list, so
 * the two surfaces never disagree about where a finished card is; see
 * `collab.functions`.
 */
import { IconPlus } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { board as dealBoard } from "@byconvo/core/collab";
import type { CollabList, CollabTodo } from "@byconvo/core/collab";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useCollabProject } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useCollabActions } from "../adapters/collab.hook.adapter";
import { COLLAB_PATH, projectPath } from "../functions/collab-layout.functions";
import {
  CollabEmpty,
  CollabPanel,
  CollabSectionHeading,
  CollabTitle,
} from "./collab-column";
import { ProjectMark } from "./project-mark";
import { TodoDue } from "./todo-due";

function AddTodo({
  projectId,
  listId,
}: {
  readonly projectId: string;
  readonly listId: string;
}) {
  const actions = useCollabActions();
  const [title, setTitle] = useState("");

  return (
    <form
      className="flex items-center gap-1.5 px-3 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        void actions
          .createTodo(projectId, title, listId)
          // Cleared only once something was actually added — a blank submit
          // leaves the box as it was rather than pretending to have worked.
          .then((created) => {
            if (created !== null) setTitle("");
          });
      }}
    >
      <Input
        value={title}
        placeholder="Add a to-do"
        aria-label="Add a to-do"
        className="h-7"
        onChange={(event) => setTitle(event.target.value)}
      />
      <Button type="submit" variant="ghost" size="icon-sm" aria-label="Add">
        <IconPlus />
      </Button>
    </form>
  );
}

function TodoRow({
  todo,
  lists,
}: {
  readonly todo: CollabTodo;
  readonly lists: ReadonlyArray<CollabList>;
}) {
  const actions = useCollabActions();
  return (
    <div className="flex min-w-0 items-center gap-2.5 px-3 py-1.5 text-[13px]">
      <Checkbox
        checked={todo.done}
        aria-label={todo.title}
        onCheckedChange={(checked) =>
          void actions.setDone(todo, checked, lists)
        }
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          todo.done && "text-muted-foreground line-through"
        )}
      >
        {todo.title}
      </span>
      {todo.assignee.length > 0 && (
        <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
          {todo.assignee}
        </span>
      )}
      <TodoDue dueOn={todo.dueOn} />
    </div>
  );
}

export function TodosPage({ projectId }: { readonly projectId: string }) {
  const detail = useCollabProject(projectId);

  if (detail.data === undefined) {
    return (
      <CollabPanel>
        <CollabEmpty>{detail.isPending ? "Loading…" : "Not here."}</CollabEmpty>
      </CollabPanel>
    );
  }

  const { project, todos } = detail.data;
  const columns = dealBoard(project, todos);

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
      >
        To-dos
      </CollabTitle>

      <div className="flex flex-col gap-6">
        {columns.map((column) => (
          <section key={column.list.id}>
            <CollabSectionHeading>{column.list.name}</CollabSectionHeading>
            <CollabPanel className="divide-y">
              {column.todos.length === 0 ? (
                <CollabEmpty>Nothing in this list.</CollabEmpty>
              ) : (
                <div className="flex flex-col py-1">
                  {column.todos.map((todo) => (
                    <TodoRow key={todo.id} todo={todo} lists={project.lists} />
                  ))}
                </div>
              )}
              <AddTodo projectId={project.id} listId={column.list.id} />
            </CollabPanel>
          </section>
        ))}
      </div>

      <p className="mt-6 text-[0.6875rem] text-muted-foreground">
        <Link to={COLLAB_PATH} className="hover:text-foreground">
          All projects
        </Link>
      </p>
    </>
  );
}
