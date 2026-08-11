/**
 * Flow — the sequence, drawn.
 *
 * One band per horizon, nearest at the top, and inside a band the cards run in
 * the order somebody actually intends to do them. Dependencies are wires: a
 * wire that runs forwards is a plan, and a wire that runs backwards is a plan
 * that cannot happen, which is the one thing a priority label could never say.
 *
 * Nothing here is an estimate. Card width means nothing, band height means
 * nothing, and the only number on a card is time already spent.
 */
import {
  IconAlertTriangle,
  IconArrowNarrowRight,
  IconHandGrab,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssigneeAvatar } from "@/interactions/collaboration/components/assignee-avatar";
import { PaneHeader } from "@/components/layout/pane-header";
import {
  ScopeGlyph,
  SCOPE_RAIL,
  SCOPE_TINT,
} from "@/interactions/collaboration/components/scope-glyph";
import {
  SpentLabel,
  TrackButton,
} from "@/interactions/collaboration/components/task-time";
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon";
import { ClaimButton } from "@/interactions/collaboration/components/up-for-grabs";
import { useTaskDrag } from "@/interactions/collaboration/components/use-task-drag";
import {
  SCOPES,
  STATUS_LABEL,
  type MockProject,
  type MockScope,
  type MockTask,
} from "@/interactions/collaboration/data/collaboration.mock";
import { useTasks } from "@/interactions/collaboration/data/use-tasks";
import {
  blockersOf,
  conflictsFor,
  firstThing,
  formatSpent,
  isUpForGrabs,
  landedTasks,
  laneTasks,
  totalSpent,
  upForGrabs,
} from "@/interactions/collaboration/functions/task-flow.functions";
import { cn } from "@/lib/utils";

type Drag = ReturnType<typeof useTaskDrag>;

interface Wire {
  id: string;
  from: string;
  to: string;
  path: string;
  conflict: boolean;
}

const CARD_WIDTH = 240;

/**
 * Two anchors and a curve. Cards side by side get a short horizontal hop;
 * anything that changes band leaves the bottom and arrives at the top, so the
 * direction of travel is legible without reading the labels.
 */
function wirePath(a: DOMRect, b: DOMRect, base: DOMRect): string {
  const ax = a.left - base.left;
  const ay = a.top - base.top;
  const bx = b.left - base.left;
  const by = b.top - base.top;
  const sameRow = Math.abs(ay - by) < a.height / 2;

  if (sameRow && bx > ax) {
    const y = ay + a.height / 2;
    const start = ax + a.width;
    const end = bx;
    const bend = Math.max(16, (end - start) / 2);
    return `M ${start} ${y} C ${start + bend} ${y}, ${end - bend} ${y}, ${end} ${y}`;
  }

  // Running back along the row would cross everything in between, so a wire
  // pointing backwards takes the long way underneath — which is also what it
  // looks like: work doubling back on itself.
  if (sameRow) {
    const floor = Math.max(ay + a.height, by + b.height);
    const start = { x: ax + a.width / 2, y: ay + a.height };
    const end = { x: bx + b.width / 2, y: by + b.height };
    const dip = floor + 22;
    return `M ${start.x} ${start.y} C ${start.x} ${dip}, ${end.x} ${dip}, ${end.x} ${end.y}`;
  }

  const start = { x: ax + a.width / 2, y: ay + a.height };
  const end = { x: bx + b.width / 2, y: by };
  const bend = Math.max(24, Math.abs(end.y - start.y) / 2);
  return `M ${start.x} ${start.y} C ${start.x} ${start.y + bend}, ${end.x} ${end.y - bend}, ${end.x} ${end.y}`;
}

function TaskCard({
  task,
  tasks,
  first,
  inside,
  drag,
  onHover,
  focused,
  register,
}: {
  task: MockTask;
  tasks: ReadonlyArray<MockTask>;
  first: boolean;
  inside: number;
  drag: Drag;
  onHover: (id: string | null) => void;
  focused: boolean;
  register: (id: string, element: HTMLElement | null) => void;
}) {
  const conflicts = conflictsFor(tasks, task);
  const waits = blockersOf(tasks, task).filter(
    (blocker) => blocker.status !== "done"
  );
  const grabbable = isUpForGrabs(tasks, task);

  return (
    <div
      ref={(element) => register(task.id, element)}
      onPointerEnter={() => onHover(task.id)}
      onPointerLeave={() => onHover(null)}
      {...drag.handleProps(task.id)}
      style={{ width: CARD_WIDTH }}
      className={cn(
        "bg-pane flex shrink-0 cursor-grab flex-col gap-2 rounded-xl border p-2.5 transition-shadow active:cursor-grabbing",
        drag.dragging === task.id && "opacity-40",
        focused ? "border-brand-500 shadow-md" : "hover:shadow-sm",
        conflicts.length > 0 && !focused && "border-destructive/50"
      )}
    >
      <div className="flex items-center gap-1.5">
        {first && (
          <span className="shrink-0 rounded-full bg-orange-500/10 px-1.5 text-[0.625rem] font-medium text-orange-600 dark:text-orange-400">
            first
          </span>
        )}
        <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">
          {task.key}
        </span>
        <span className="ml-auto" />
        <SpentLabel task={task} />
        <TrackButton task={task} />
      </div>

      <Link
        to="/modes/collaboration"
        search={{ view: "task", id: task.id }}
        {...drag.keyProps(task)}
        className="flex flex-col gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        <p className="line-clamp-2 text-[0.8125rem] leading-5">{task.title}</p>

        {conflicts.length > 0 ? (
          <p className="flex items-start gap-1 text-[0.6875rem] leading-4 text-destructive">
            <IconAlertTriangle className="mt-px size-3 shrink-0" />
            <span>
              Waits on {conflicts[0].blocker.key}, which is planned after it.
            </span>
          </p>
        ) : (
          waits.length > 0 && (
            <p className="flex items-center gap-1 truncate text-[0.6875rem] text-muted-foreground">
              <IconArrowNarrowRight className="size-3 shrink-0" />
              after {waits.map((blocker) => blocker.key).join(", ")}
            </p>
          )
        )}
      </Link>

      <div className="flex items-center gap-1.5">
        <TaskStatusIcon status={task.status} />
        <span className="min-w-0 truncate text-[0.6875rem] text-muted-foreground">
          {STATUS_LABEL[task.status]}
          {inside > 0 && ` · ${inside} inside`}
        </span>
        <span className="ml-auto" />
        {grabbable ? (
          <ClaimButton task={task} />
        ) : (
          <AssigneeAvatar name={task.assignee} className="size-5" />
        )}
      </div>
    </div>
  );
}

function CardSlot({
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
      className="relative -mx-1 w-2 shrink-0 self-stretch"
    >
      <div
        className={cn(
          "absolute inset-y-1 left-1/2 w-0.5 -translate-x-1/2 rounded-full",
          active ? "bg-brand-500" : "bg-transparent"
        )}
      />
    </div>
  );
}

function Band({
  scope,
  project,
  tasks,
  drag,
  firstId,
  hovered,
  onHover,
  register,
}: {
  scope: MockScope;
  project: MockProject;
  tasks: ReadonlyArray<MockTask>;
  drag: Drag;
  firstId: string | undefined;
  hovered: string | null;
  onHover: (id: string | null) => void;
  register: (id: string, element: HTMLElement | null) => void;
}) {
  const lane = laneTasks(tasks, project.id, scope.id);
  const tracked = totalSpent(lane);
  const over =
    scope.capacity !== null && lane.length > scope.capacity
      ? lane.length - scope.capacity
      : 0;

  return (
    <section className={cn("border-b px-4 py-3", SCOPE_TINT[scope.kind])}>
      <div className="flex items-center gap-2">
        <ScopeGlyph kind={scope.kind} />
        <h2 className="text-[0.8125rem] font-medium">{scope.name}</h2>
        <span className="text-xs text-muted-foreground">{scope.window}</span>
        <span className="text-xs text-muted-foreground/60">·</span>
        <span className="text-xs text-muted-foreground">{scope.left}</span>
        {tracked > 0 && (
          <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
            {formatSpent(tracked)} tracked
          </span>
        )}
        {scope.capacity !== null && (
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              tracked === 0 && "ml-auto",
              over > 0 ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {over > 0
              ? `${lane.length} in a horizon that holds ${scope.capacity}`
              : `${lane.length} of ${scope.capacity}`}
          </span>
        )}
      </div>

      {scope.kind !== "out" && (
        <div className="mt-2 h-0.5 rounded-full bg-border/50">
          <div
            className={cn("h-full rounded-full", SCOPE_RAIL[scope.kind])}
            style={{ width: `${scope.elapsed * 100}%` }}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-stretch gap-3">
        {lane.map((task, index) => (
          <div key={task.id} className="flex items-stretch">
            <CardSlot drag={drag} scopeId={scope.id} index={index} />
            <TaskCard
              task={task}
              tasks={tasks}
              first={task.id === firstId}
              inside={laneTasks(tasks, project.id, scope.id, task.id).length}
              drag={drag}
              onHover={onHover}
              focused={hovered === task.id}
              register={register}
            />
          </div>
        ))}
        <div className="flex items-stretch">
          <CardSlot drag={drag} scopeId={scope.id} index={lane.length} />
          {lane.length === 0 && (
            <div
              {...drag.slotProps(scope.id, 0)}
              className={cn(
                "grid h-16 place-items-center rounded-xl border border-dashed px-4 text-xs text-muted-foreground/70",
                drag.isActiveSlot(scope.id, 0) &&
                  "border-brand-500 text-foreground"
              )}
              style={{ width: CARD_WIDTH }}
            >
              Nothing in this horizon
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function FlowView({ project }: { project: MockProject }) {
  const tasks = useTasks();
  const drag = useTaskDrag(tasks);
  const first = firstThing(tasks, project.id);
  const [hovered, setHovered] = useState<string | null>(null);
  const [wires, setWires] = useState<ReadonlyArray<Wire>>([]);
  const frame = useRef<HTMLDivElement | null>(null);
  const cards = useRef(new Map<string, HTMLElement>());

  const register = useCallback((id: string, element: HTMLElement | null) => {
    if (element === null) cards.current.delete(id);
    else cards.current.set(id, element);
  }, []);

  const measure = useCallback(() => {
    const root = frame.current;
    if (root === null) return;
    const base = root.getBoundingClientRect();
    const drawn: Array<Wire> = [];
    for (const task of tasks) {
      if (task.projectId !== project.id || task.status === "done") continue;
      const to = cards.current.get(task.id);
      if (to === undefined) continue;
      const conflicting = new Set(
        conflictsFor(tasks, task).map((conflict) => conflict.blocker.id)
      );
      for (const blocker of blockersOf(tasks, task)) {
        const from = cards.current.get(blocker.id);
        if (from === undefined) continue;
        drawn.push({
          id: `${blocker.id}-${task.id}`,
          from: blocker.id,
          to: task.id,
          path: wirePath(
            from.getBoundingClientRect(),
            to.getBoundingClientRect(),
            base
          ),
          conflict: conflicting.has(blocker.id),
        });
      }
    }
    setWires(drawn);
  }, [tasks, project.id]);

  useEffect(() => {
    measure();
    const root = frame.current;
    if (root === null) return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [measure]);

  const impossible = tasks.filter(
    (task) =>
      task.projectId === project.id && conflictsFor(tasks, task).length > 0
  );
  const grabbable = upForGrabs(tasks, project.id);
  const landed = landedTasks(tasks, project.id);

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
          <span key="flow" className="font-medium">
            Flow
          </span>,
        ]}
      />

      <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2.5 text-[0.8125rem]">
        <span className="text-muted-foreground">First</span>
        {first === undefined ? (
          <span className="text-muted-foreground">nothing in any horizon</span>
        ) : (
          <Link
            to="/modes/collaboration"
            search={{ view: "task", id: first.id }}
            className="flex min-w-0 items-center gap-2 outline-none hover:underline focus-visible:underline"
          >
            <TaskStatusIcon status={first.status} />
            <span className="truncate font-medium">{first.title}</span>
          </Link>
        )}
        <span className="ml-auto" />
        {grabbable.length > 0 && (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <IconHandGrab className="size-3.5" />
            {grabbable.length} up for grabs
          </span>
        )}
        {impossible.length > 0 && (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
            <IconAlertTriangle className="size-3.5" />
            {impossible.length} {impossible.length === 1 ? "plan" : "plans"}{" "}
            that cannot happen in this order
          </span>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <div ref={frame} className="relative">
          <svg
            role="presentation"
            className="pointer-events-none absolute inset-0 size-full overflow-visible"
          >
            <defs>
              <marker
                id="flow-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current" />
              </marker>
            </defs>
            {wires.map((wire) => {
              const lit = hovered === wire.from || hovered === wire.to;
              return (
                <path
                  key={wire.id}
                  d={wire.path}
                  fill="none"
                  markerEnd="url(#flow-arrow)"
                  strokeWidth={lit ? 2 : 1.25}
                  className={cn(
                    wire.conflict
                      ? "text-destructive [stroke-dasharray:5_4]"
                      : lit
                        ? "text-brand-500"
                        : "text-muted-foreground/40"
                  )}
                  stroke="currentColor"
                />
              );
            })}
          </svg>

          {SCOPES.map((scope) => (
            <Band
              key={scope.id}
              scope={scope}
              project={project}
              tasks={tasks}
              drag={drag}
              firstId={first?.id}
              hovered={hovered}
              onHover={setHovered}
              register={register}
            />
          ))}

          {landed.length > 0 && (
            <section className="px-4 py-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[0.8125rem] font-medium">Landed</h2>
                <span className="text-xs text-muted-foreground">
                  out of the sequence
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {landed.length} · {formatSpent(totalSpent(landed))} spent
                </span>
              </div>
              <ul role="list" className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {landed.map((task) => (
                  <li key={task.id}>
                    <Link
                      to="/modes/collaboration"
                      search={{ view: "task", id: task.id }}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
                    >
                      <TaskStatusIcon
                        status={task.status}
                        className="size-3.5"
                      />
                      <span className="font-mono">{task.key}</span>
                      <span className="truncate">{task.title}</span>
                      <span className="tabular-nums">
                        {formatSpent(task.spent)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
