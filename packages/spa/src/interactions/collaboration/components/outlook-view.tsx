/**
 * Outlook — what will be done by the end of a horizon, across every project.
 *
 * Horizons nest, so picking "this month" means today, this week, the cutover
 * window and this month all at once. That makes the question answerable without
 * anybody estimating anything: the answer is whatever people have committed to
 * that far out, and it is only as good as those commitments.
 *
 * Which is why the reading beside it matters more than the list. A quarter with
 * nine unfigured things in it is not a plan, and this view says so in the same
 * breath as it says what the plan is.
 */
import { IconAlertTriangle, IconHandGrab } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssigneeAvatar } from "@/interactions/collaboration/components/assignee-avatar";
import { PaneHeader } from "@/components/layout/pane-header";
import { ScopeGlyph } from "@/interactions/collaboration/components/scope-glyph";
import { SpentLabel } from "@/interactions/collaboration/components/task-time";
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon";
import { ClaimButton } from "@/interactions/collaboration/components/up-for-grabs";
import {
  DEFAULT_SCOPE,
  findScope,
  PROJECTS,
  SCOPES,
  scopeRank,
  type MockScope,
  type MockTask,
} from "@/interactions/collaboration/data/collaboration.mock";
import { useTasks } from "@/interactions/collaboration/data/use-tasks";
import {
  beyondHorizon,
  certaintyOf,
  conflictsFor,
  formatRough,
  formatWaited,
  growth,
  isUpForGrabs,
  nextDecision,
  readHorizon,
  withinHorizon,
} from "@/interactions/collaboration/functions/task-flow.functions";
import { cn } from "@/lib/utils";

/** Only real stretches of time can be asked about; out of scope is not one. */
const HORIZONS = SCOPES.filter((scope) => scope.kind !== "out");

function Reading({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone?: "warn" | "quiet";
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-w-24 flex-col gap-0.5">
      <span
        className={cn(
          "flex items-center gap-1.5 text-lg font-semibold tabular-nums",
          tone === "warn" && "text-destructive",
          tone === "quiet" && "text-muted-foreground"
        )}
      >
        {icon}
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

function TaskRow({
  task,
  tasks,
  scope,
}: {
  task: MockTask;
  tasks: ReadonlyArray<MockTask>;
  scope: MockScope | undefined;
}) {
  const conflicts = conflictsFor(tasks, task);
  return (
    <Link
      to="/modes/collaboration"
      search={{ view: "task", id: task.id }}
      className="flex h-9 items-center gap-2.5 rounded-lg px-2 text-[13px] outline-none hover:bg-elevate focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <TaskStatusIcon status={task.status} />
      <span className="w-16 shrink-0 truncate font-mono text-xs text-muted-foreground">
        {task.key}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          task.status === "done" && "text-muted-foreground"
        )}
      >
        {task.title}
      </span>
      {conflicts.length > 0 && (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-1.5 text-[0.6875rem] text-destructive">
          <IconAlertTriangle className="size-3" />
          after {conflicts[0].blocker.key}
        </span>
      )}
      {scope !== undefined && (
        <span className="flex w-32 shrink-0 items-center gap-1.5 text-xs text-muted-foreground max-sm:hidden">
          <ScopeGlyph kind={scope.kind} className="size-3.5" />
          <span className="truncate">{scope.name}</span>
        </span>
      )}
      <SpentLabel task={task} />
      {isUpForGrabs(tasks, task) ? (
        <ClaimButton task={task} />
      ) : (
        <AssigneeAvatar name={task.assignee} />
      )}
    </Link>
  );
}

export function OutlookView({ scopeId }: { scopeId: string }) {
  const tasks = useTasks();
  const horizon = findScope(scopeId) ?? findScope(DEFAULT_SCOPE) ?? HORIZONS[0];
  const reading = readHorizon(tasks, horizon.id);
  const inside = withinHorizon(tasks, horizon.id);
  const later = beyondHorizon(tasks, horizon.id);
  const shelved = tasks.filter((task) => task.scopeId === "out");

  const unknown = inside
    .filter((task) => certaintyOf(tasks, task) === "unknown")
    .map((task) => ({ task, decides: nextDecision(tasks, task) }))
    .filter(
      (entry): entry is { task: MockTask; decides: MockTask } =>
        entry.decides !== undefined
    );

  const byProject = PROJECTS.map((project) => ({
    project,
    tasks: inside
      .filter((task) => task.projectId === project.id)
      .sort(
        (a, b) =>
          scopeRank(a.scopeId) - scopeRank(b.scopeId) || a.sequence - b.sequence
      ),
  })).filter((group) => group.tasks.length > 0);

  return (
    <>
      <PaneHeader
        foot
        crumbs={[
          <span key="section" className="text-muted-foreground">
            Workspace
          </span>,
          <span key="name" className="font-medium">
            Outlook
          </span>,
        ]}
      />

      <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b px-4 py-2">
        {HORIZONS.map((scope) => (
          <Link
            key={scope.id}
            to="/modes/collaboration"
            search={{ view: "outlook", id: scope.id }}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
              scope.id === horizon.id
                ? "bg-muted font-medium"
                : "text-muted-foreground hover:bg-elevate hover:text-foreground"
            )}
          >
            <ScopeGlyph kind={scope.kind} className="size-3.5" />
            {scope.name}
          </Link>
        ))}
      </div>

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <div className="mx-auto w-full max-w-4xl px-6 py-8">
          <h1 className="text-xl font-semibold tracking-tight text-balance">
            What will be done by the end of {horizon.name.toLowerCase()}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {horizon.window} · {horizon.left}. Everything committed this far out
            or nearer.
          </p>

          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-5 rounded-xl border px-4 py-4">
            <Reading label="things in the plan" value={String(reading.total)} />
            <Reading
              label="already landed"
              value={String(reading.landed)}
              tone="quiet"
            />
            <Reading
              label="worked"
              value={formatRough(reading.tracked)}
              tone="quiet"
            />
            <Reading
              label="spent waiting"
              value={formatWaited(reading.waited)}
              tone="quiet"
            />
            <Reading
              label="nobody holds"
              value={String(reading.unclaimed)}
              tone="quiet"
              icon={
                reading.unclaimed > 0 ? (
                  <IconHandGrab className="size-4" />
                ) : undefined
              }
            />
          </div>

          <h2 className="mt-8 text-[0.8125rem] font-medium">
            Why a date would be a guess
          </h2>
          <p className="mt-1 max-w-[70ch] text-[13px] text-pretty text-muted-foreground">
            Nobody here estimated anything, so none of this is a missed promise.
            It is what has already happened to the plan.
          </p>
          <div className="mt-3 flex flex-wrap gap-x-10 gap-y-5 rounded-xl border px-4 py-4">
            <Reading
              label="nobody has worked out yet"
              value={String(reading.figuring)}
              tone={reading.figuring > 0 ? "warn" : "quiet"}
            />
            <Reading
              label="things reality added"
              value={String(reading.grown)}
              tone={reading.grown > 0 ? "warn" : "quiet"}
            />
            <Reading
              label="pushed twice or more"
              value={String(reading.pushed)}
              tone={reading.pushed > 0 ? "warn" : "quiet"}
            />
            <Reading
              label="orders that cannot happen"
              value={String(reading.impossible)}
              tone={reading.impossible > 0 ? "warn" : "quiet"}
            />
            <Reading
              label="landed but still breaking"
              value={String(reading.unfinished)}
              tone={reading.unfinished > 0 ? "warn" : "quiet"}
            />
          </div>

          {unknown.length > 0 && (
            <section className="mt-6 rounded-xl border border-violet-500/30 bg-violet-500/5 px-4 py-3.5">
              <h3 className="text-[0.8125rem] font-medium">
                When we will know
              </h3>
              <p className="mt-1 max-w-[70ch] text-[13px] text-pretty text-muted-foreground">
                {unknown.length} of these {reading.total} have no honest date,
                because nobody has worked them out yet. What can be given
                instead is the thing that has to be decided first — answer these
                and the rest of the plan stops being a guess.
              </p>
              <ul role="list" className="mt-2.5 flex flex-col gap-1">
                {unknown.map(({ task, decides }) => (
                  <li
                    key={task.id}
                    className="flex flex-wrap items-center gap-x-2 text-[13px]"
                  >
                    <Link
                      to="/modes/collaboration"
                      search={{ view: "task", id: task.id }}
                      className="flex min-w-0 items-center gap-1.5 outline-none hover:underline focus-visible:underline"
                    >
                      <TaskStatusIcon status={task.status} />
                      <span className="truncate">{task.title}</span>
                    </Link>
                    <span className="text-muted-foreground">
                      {decides.id === task.id
                        ? "being worked out now"
                        : `waits on ${decides.key} being worked out`}
                      {growth(task) > 0 && ` · already grew ${growth(task)}×`}
                      {task.pushes > 0 && ` · pushed ${task.pushes}×`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {byProject.map(({ project, tasks: rows }) => (
            <section key={project.id} className="mt-8">
              <div className="flex h-6 items-center gap-2">
                <span
                  className="size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)"
                  style={{ "--mark": project.color } as CSSProperties}
                />
                <h2 className="text-[0.8125rem] font-medium">{project.name}</h2>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {rows.length}
                </span>
                <Link
                  to="/modes/collaboration"
                  search={{ view: "flow", id: project.id }}
                  className="ml-auto rounded-md text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
                >
                  Flow
                </Link>
              </div>
              <ul role="list" className="mt-1">
                {rows.map((task) => (
                  <li key={task.id}>
                    <TaskRow
                      task={task}
                      tasks={tasks}
                      scope={findScope(task.scopeId)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {byProject.length === 0 && (
            <p className="mt-8 text-sm text-muted-foreground">
              Nothing is committed this far out.
            </p>
          )}

          <section className="mt-10 border-t pt-6">
            <h2 className="text-[0.8125rem] font-medium">
              What will not be done
            </h2>
            <p className="mt-1 max-w-[70ch] text-[13px] text-pretty text-muted-foreground">
              {later.length > 0
                ? `${later.length} ${later.length === 1 ? "thing sits" : "things sit"} further out than ${horizon.name.toLowerCase()}`
                : "Nothing sits further out"}
              {shelved.length > 0
                ? `, and ${shelved.length} ${shelved.length === 1 ? "is" : "are"} out of scope entirely.`
                : "."}{" "}
              Saying so is the other half of the answer.
            </p>
            <ul role="list" className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {later.map((task) => (
                <li key={task.id}>
                  <Link
                    to="/modes/collaboration"
                    search={{ view: "task", id: task.id }}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
                  >
                    <ScopeGlyph
                      kind={findScope(task.scopeId)?.kind ?? "out"}
                      className="size-3.5"
                    />
                    <span className="font-mono">{task.key}</span>
                    <span className="truncate">{task.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </ScrollArea>
    </>
  );
}
