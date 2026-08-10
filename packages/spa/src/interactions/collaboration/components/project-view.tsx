/**
 * A project's overview. It deliberately does not re-list every task: the Tasks
 * view does that, so this pane shows the handful actually moving.
 */
import { IconArrowRight, IconDots } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { type CSSProperties, type ReactNode } from "react";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssigneeAvatar } from "@/interactions/collaboration/components/assignee-avatar";
import { PaneBody, PaneHeader } from "@/components/layout/pane-header";
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon";
import {
  projectTasks,
  UNASSIGNED,
  type MockProject,
  type TaskStatus,
} from "@/interactions/collaboration/data/collaboration.mock";

/** Open work, most-moved first — the order "Up next" picks from. */
const UP_NEXT_ORDER: ReadonlyArray<TaskStatus> = ["doing", "review", "todo"];

const UP_NEXT_LIMIT = 5;

const ROW =
  "flex h-9 items-center gap-2.5 rounded-lg px-2 outline-none hover:bg-elevate focus-visible:ring-3 focus-visible:ring-ring/30";

function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mt-8 flex h-6 items-center gap-3">
      <h2 className="text-[0.8125rem] font-medium">{title}</h2>
      {action !== undefined && <div className="ml-auto">{action}</div>}
    </div>
  );
}

function SeeAll({
  label,
  to,
  search,
}: {
  label: string;
  to: string;
  search: { view: "tasks" | "docs"; id: string };
}) {
  return (
    <Link
      to={to}
      search={search}
      className="flex items-center gap-1 rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      {label}
      <IconArrowRight className="size-3.5 shrink-0" />
    </Link>
  );
}

export function ProjectView({ project }: { project: MockProject }) {
  const tasks = projectTasks(project.id);

  const open = UP_NEXT_ORDER.flatMap((status) =>
    tasks.filter((t) => t.status === status)
  );
  const upNext = open.slice(0, UP_NEXT_LIMIT);
  const people = [
    ...new Set(tasks.map((t) => t.assignee).filter((a) => a !== UNASSIGNED)),
  ];

  return (
    <>
      <PaneHeader
        crumbs={[
          <span key="section" className="text-muted-foreground">
            Projects
          </span>,
          <span key="name" className="truncate font-medium">
            {project.name}
          </span>,
        ]}
        actions={
          <>
            <AvatarStack names={people} />
            <Button variant="ghost" size="icon-sm" aria-label="Project options">
              <IconDots className="size-4" />
            </Button>
          </>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <PaneBody>
          <div className="flex items-center gap-2.5">
            <span
              className="size-5 shrink-0 rounded-lg bg-(--mark)"
              style={{ "--mark": project.color } as CSSProperties}
            />
            <h1 className="min-w-0 truncate text-lg font-semibold">
              {project.name}
            </h1>
          </div>
          <p className="mt-2 max-w-[70ch] text-base text-pretty text-muted-foreground sm:text-sm">
            {project.summary}
          </p>

          <SectionHeading
            title="Up next"
            action={
              <SeeAll
                label={`All ${tasks.length} tasks`}
                to="/modes/collaboration"
                search={{ view: "tasks", id: project.id }}
              />
            }
          />
          {upNext.length > 0 ? (
            <ul role="list" className="@container mt-1">
              {upNext.map((task) => (
                <li key={task.id}>
                  <Link
                    to="/modes/collaboration"
                    search={{ view: "task", id: task.id }}
                    className={ROW}
                  >
                    <TaskStatusIcon status={task.status} />
                    <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground @max-xs:hidden">
                      {task.key}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem]">
                      {task.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums @max-sm:hidden">
                      {task.updated}
                    </span>
                    <AssigneeAvatar name={task.assignee} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 px-2 py-3 text-[0.8125rem] text-muted-foreground">
              Every task in this project is done.
            </p>
          )}
        </PaneBody>
      </ScrollArea>
    </>
  );
}
