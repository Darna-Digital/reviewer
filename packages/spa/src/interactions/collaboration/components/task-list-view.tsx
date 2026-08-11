/**
 * A project's tasks, grouped by the horizon they sit in rather than by a label
 * somebody applied to them. Inside a horizon the order is the plan: first,
 * second, third, dragged into place. Landed work drops out of the sequence
 * entirely and collects at the foot with what it cost.
 */
import {
  IconAlertTriangle,
  IconChevronRight,
  IconLayoutSidebarRightExpand,
  IconAdjustmentsHorizontal,
  IconCircleCheckFilled,
  IconFilter,
  IconGripVertical,
  IconPlus,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssigneeAvatar } from "@/interactions/collaboration/components/assignee-avatar";
import { PaneHeader } from "@/components/layout/pane-header";
import {
  ScopeGlyph,
  SCOPE_RAIL,
  SCOPE_TINT,
} from "@/interactions/collaboration/components/scope-glyph";
import { SpentLabel } from "@/interactions/collaboration/components/task-time";
import { ClaimButton } from "@/interactions/collaboration/components/up-for-grabs";
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon";
import { useTaskDrag } from "@/interactions/collaboration/components/use-task-drag";
import {
  SCOPES,
  type MockProject,
  type MockScope,
  type MockTask,
} from "@/interactions/collaboration/data/collaboration.mock";
import { useTasks } from "@/interactions/collaboration/data/use-tasks";
import {
  conflictsFor,
  firstThing,
  formatSpent,
  growth,
  isUpForGrabs,
  landedTasks,
  laneTasks,
  totalSpent,
} from "@/interactions/collaboration/functions/task-flow.functions";
import { cn } from "@/lib/utils";

type Drag = ReturnType<typeof useTaskDrag>;

/** Where a dropped task would land. Two pixels of honesty about the position. */
function Slot({
  drag,
  scopeId,
  index,
}: {
  drag: Drag;
  scopeId: string;
  index: number;
}) {
  const active = drag.isActiveSlot(scopeId, index);
  return (
    <div
      {...drag.slotProps(scopeId, index)}
      className={cn(
        "relative -my-1 h-2 transition-colors",
        drag.dragging !== null && "z-10"
      )}
    >
      <div
        className={cn(
          "absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 rounded-full",
          active ? "bg-brand-500" : "bg-transparent"
        )}
      />
    </div>
  );
}

function TaskRow({
  task,
  tasks,
  first,
  drag,
  nested,
}: {
  task: MockTask;
  tasks: ReadonlyArray<MockTask>;
  first: boolean;
  drag: Drag;
  nested?: boolean;
}) {
  const conflicts = conflictsFor(tasks, task);
  const grabbable = isUpForGrabs(tasks, task);
  const drift = [
    growth(task) > 0 ? `grew ${growth(task)}×` : null,
    task.pushes > 0 ? `pushed ${task.pushes}×` : null,
  ].filter((entry) => entry !== null);

  return (
    <div
      className={cn(
        "group/row flex h-9 items-center gap-1 border-l-2 pr-3 pl-1",
        first ? "border-l-orange-500" : "border-l-transparent",
        drag.dragging === task.id ? "opacity-40" : "hover:bg-elevate"
      )}
    >
      <span
        {...drag.handleProps(task.id)}
        aria-hidden
        className="grid size-5 shrink-0 cursor-grab place-items-center text-muted-foreground/25 group-hover/row:text-muted-foreground active:cursor-grabbing"
      >
        <IconGripVertical className="size-3.5" />
      </span>
      <Link
        to="/modes/collaboration"
        search={{ view: "task", id: task.id }}
        {...drag.keyProps(task)}
        className={cn(
          "flex h-full min-w-0 flex-1 items-center gap-2.5 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
          nested === true && "pl-6"
        )}
      >
        <span className="w-16 shrink-0 truncate font-mono text-xs text-muted-foreground">
          {task.key}
        </span>
        <TaskStatusIcon status={task.status} />
        <span className="min-w-0 flex-1 truncate">{task.title}</span>
        {conflicts.length > 0 && (
          <span
            title={`Waits on ${conflicts[0].blocker.key}, which is planned after it`}
            className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-1.5 text-[0.6875rem] text-destructive"
          >
            <IconAlertTriangle className="size-3" />
            after {conflicts[0].blocker.key}
          </span>
        )}
        {drift.length > 0 && (
          <span className="shrink-0 text-[0.6875rem] text-muted-foreground/80 max-sm:hidden">
            {drift.join(" · ")}
          </span>
        )}
        <SpentLabel task={task} />
        {grabbable ? (
          <ClaimButton task={task} />
        ) : (
          <AssigneeAvatar name={task.assignee} />
        )}
        <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
          {task.updated}
        </span>
      </Link>
    </div>
  );
}

function ScopeGroup({
  scope,
  project,
  tasks,
  drag,
  firstId,
}: {
  scope: MockScope;
  project: MockProject;
  tasks: ReadonlyArray<MockTask>;
  drag: Drag;
  firstId: string | undefined;
}) {
  const [open, setOpen] = useState(true);
  const lane = laneTasks(tasks, project.id, scope.id);
  const inScope = lane.flatMap((task) => [
    task,
    ...laneTasks(tasks, project.id, scope.id, task.id),
  ]);
  const tracked = totalSpent(inScope);
  const over =
    scope.capacity !== null && lane.length > scope.capacity
      ? lane.length - scope.capacity
      : 0;

  return (
    <section>
      <div
        className={cn(
          "sticky top-0 z-20 flex h-9 items-center gap-2 px-3",
          SCOPE_TINT[scope.kind]
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${scope.name}`}
          className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <IconChevronRight
            className={cn(
              "size-3 transition-transform duration-100",
              open && "rotate-90"
            )}
          />
        </button>
        <ScopeGlyph kind={scope.kind} />
        <h2 className="text-[13px] font-medium">{scope.name}</h2>
        <span className="truncate text-xs text-muted-foreground max-sm:hidden">
          {scope.window} · {scope.left}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-3">
          {tracked > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatSpent(tracked)} tracked
            </span>
          )}
          {scope.capacity !== null && (
            <span
              className={cn(
                "text-xs tabular-nums",
                over > 0 ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {over > 0
                ? `${lane.length} in a horizon that holds ${scope.capacity}`
                : `${lane.length} of ${scope.capacity}`}
            </span>
          )}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={`Add a task to ${scope.name}`}
        >
          <IconPlus className="size-4" />
        </Button>
      </div>

      {scope.kind !== "out" && (
        <div className="h-0.5 bg-border/40">
          <div
            className={cn("h-full", SCOPE_RAIL[scope.kind])}
            style={{ width: `${scope.elapsed * 100}%` }}
          />
        </div>
      )}

      {open && (
        <div className="py-1">
          {lane.map((task, index) => (
            <div key={task.id}>
              <Slot drag={drag} scopeId={scope.id} index={index} />
              <TaskRow
                task={task}
                tasks={tasks}
                first={task.id === firstId}
                drag={drag}
              />
              {laneTasks(tasks, project.id, scope.id, task.id).map((child) => (
                <TaskRow
                  key={child.id}
                  task={child}
                  tasks={tasks}
                  first={false}
                  drag={drag}
                  nested
                />
              ))}
            </div>
          ))}
          <Slot drag={drag} scopeId={scope.id} index={lane.length} />
          {lane.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-muted-foreground/70">
              Nothing here. Drag something in.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** The retrospective. No percentage, no burndown — what it took, and that is all. */
function LandedGroup({ tasks }: { tasks: ReadonlyArray<MockTask> }) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;

  return (
    <section>
      <div className="sticky top-0 z-20 flex h-9 items-center gap-2 bg-emerald-500/5 px-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} Landed`}
          className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <IconChevronRight
            className={cn(
              "size-3 transition-transform duration-100",
              open && "rotate-90"
            )}
          />
        </button>
        <IconCircleCheckFilled className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-[13px] font-medium">Landed</h2>
        <span className="text-xs text-muted-foreground tabular-nums">
          {tasks.length}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatSpent(totalSpent(tasks))} spent
        </span>
      </div>
      {open && (
        <div className="py-1">
          {tasks.map((task) => (
            <Link
              key={task.id}
              to="/modes/collaboration"
              search={{ view: "task", id: task.id }}
              className="flex h-9 items-center gap-2.5 px-3 pl-9 text-[13px] outline-none hover:bg-elevate focus-visible:bg-elevate"
            >
              <span className="w-16 shrink-0 truncate font-mono text-xs text-muted-foreground">
                {task.key}
              </span>
              <TaskStatusIcon status={task.status} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {task.title}
              </span>
              <SpentLabel task={task} />
              <AssigneeAvatar name={task.assignee} />
              <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {task.updated}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function TaskListView({ project }: { project: MockProject }) {
  const tasks = useTasks();
  const drag = useTaskDrag(tasks);
  const first = firstThing(tasks, project.id);

  return (
    <>
      <PaneHeader
        foot
        crumbs={[
          <Link
            key="project"
            to="/modes/collaboration"
            search={{ view: "project", id: project.id }}
            className="flex min-w-0 items-center gap-1.5 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            <span
              className="size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)"
              style={{ "--mark": project.color } as CSSProperties}
            />
            <span className="truncate">{project.name}</span>
          </Link>,
          <span key="tasks" className="font-medium">
            Tasks
          </span>,
        ]}
        actions={
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Filter"
            >
              <IconFilter className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Display options"
            >
              <IconAdjustmentsHorizontal className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Toggle the side panel"
            >
              <IconLayoutSidebarRightExpand className="size-4" />
            </Button>
          </>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        {SCOPES.map((scope) => (
          <ScopeGroup
            key={scope.id}
            scope={scope}
            project={project}
            tasks={tasks}
            drag={drag}
            firstId={first?.id}
          />
        ))}
        <LandedGroup tasks={landedTasks(tasks, project.id)} />
      </ScrollArea>
    </>
  );
}
