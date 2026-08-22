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
import { ScopeGlyph } from "@/interactions/collaboration/components/scope-glyph";
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon";
import {
  findScope,
  projectTasks,
  SCOPES,
  UNASSIGNED,
  type MockProject,
} from "@/interactions/collaboration/data/collaboration.mock";
import {
  formatSpent,
  landedTasks,
  scopeTasks,
  totalSpent,
} from "@/interactions/collaboration/functions/task-flow.functions";

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
  search: { view: "tasks" | "flow" | "docs"; id: string };
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

  const sequence = SCOPES.filter((scope) => scope.kind !== "out").flatMap(
    (scope) => scopeTasks(tasks, project.id, scope.id)
  );
  const upNext = sequence.slice(0, UP_NEXT_LIMIT);
  const landed = landedTasks(tasks, project.id);
  const people = [
    ...new Set(tasks.map((t) => t.assignee).filter((a) => a !== UNASSIGNED)),
  ];

  return (
    <>
      <PaneHeader
        foot
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
                label="The whole flow"
                to="/modes/experimentation/collaboration"
                search={{ view: "flow", id: project.id }}
              />
            }
          />
          {upNext.length > 0 ? (
            <ul role="list" className="@container mt-1">
              {upNext.map((task) => (
                <li key={task.id}>
                  <Link
                    to="/modes/experimentation/collaboration"
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
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground @max-sm:hidden">
                      <ScopeGlyph
                        kind={findScope(task.scopeId)?.kind ?? "out"}
                        className="size-3.5"
                      />
                      {findScope(task.scopeId)?.name}
                    </span>
                    <AssigneeAvatar name={task.assignee} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 px-2 py-3 text-[0.8125rem] text-muted-foreground">
              Nothing is in any horizon.
            </p>
          )}

          <SectionHeading title="Where the time went" />
          <p className="mt-1 max-w-[70ch] text-[0.8125rem] text-muted-foreground">
            {landed.length === 0
              ? "Nothing has landed yet, so there is nothing to look back on."
              : `${formatSpent(totalSpent(landed))} across ${landed.length} landed ${landed.length === 1 ? "task" : "tasks"}, and ${formatSpent(totalSpent(tasks) - totalSpent(landed))} into work still in a horizon.`}
          </p>
          {landed.length > 0 && (
            <ul role="list" className="mt-1">
              {landed.map((task) => (
                <li key={task.id}>
                  <Link
                    to="/modes/experimentation/collaboration"
                    search={{ view: "task", id: task.id }}
                    className={ROW}
                  >
                    <TaskStatusIcon status={task.status} />
                    <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground @max-xs:hidden">
                      {task.key}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-muted-foreground">
                      {task.title}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {formatSpent(task.spent)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </PaneBody>
      </ScrollArea>
    </>
  );
}
