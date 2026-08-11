/**
 * A single task. The properties down the right side are the whole model in one
 * column: which horizon it sits in, what position it holds there, what has to
 * happen first, and how much time has actually gone into it. There is no field
 * for how important it is, because there is nothing honest to put in one.
 */
import {
  IconSend,
  IconAlertTriangle,
  IconHourglass,
  IconChevronDown,
  IconChevronUp,
  IconDots,
  IconGitBranch,
  IconLink,
  IconMoodPlus,
  IconPaperclip,
  IconPlus,
  IconStar,
  IconTag,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssigneeAvatar } from "@/interactions/collaboration/components/assignee-avatar";
import { announceMove } from "@/interactions/collaboration/components/announce-move";
import { ScopeGlyph } from "@/interactions/collaboration/components/scope-glyph";
import {
  SpentLabel,
  TrackButton,
} from "@/interactions/collaboration/components/task-time";
import { TaskDiscoveries } from "@/interactions/collaboration/components/task-discoveries";
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon";
import { ClaimButton } from "@/interactions/collaboration/components/up-for-grabs";
import {
  findProject,
  findScope,
  findTask,
  moveTaskTo,
  SCOPES,
  setTaskStatus,
  STATUS_LABEL,
  STATUS_MEANING,
  STATUS_ORDER,
  taskChildren,
  VIEWER,
  type MockActivity,
  type MockTask,
} from "@/interactions/collaboration/data/collaboration.mock";
import { useTasks } from "@/interactions/collaboration/data/use-tasks";
import {
  blocking,
  blockersOf,
  certaintyOf,
  CERTAINTY_LABEL,
  conflictsFor,
  formatSpent,
  formatWaited,
  growth,
  isUpForGrabs,
  laneTasks,
  nextDecision,
  openSymptoms,
  paceFor,
  symptomsOf,
} from "@/interactions/collaboration/functions/task-flow.functions";
import { cn } from "@/lib/utils";

const PROPERTY_ROW =
  "flex h-7 w-full items-center gap-2 rounded-md px-1.5 text-[13px] outline-none hover:bg-elevate focus-visible:ring-3 focus-visible:ring-ring/30";

function ActivityEntry({ entry }: { entry: MockActivity }) {
  if (entry.kind === "comment") {
    return (
      <li className="rounded-xl border bg-elevate">
        <div className="flex items-center gap-2 px-3 pt-2.5">
          <Avatar name={entry.author} className="size-5" />
          <span className="text-[13px] font-medium">{entry.author}</span>
          <span className="text-xs text-muted-foreground">{entry.time}</span>
        </div>
        <p className="px-3 pt-1 pb-3 text-sm text-pretty">{entry.body}</p>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
      <Avatar name={entry.author} className="size-4" />
      <span className="min-w-0 truncate">
        <span className="text-foreground">{entry.author}</span> {entry.detail}
      </span>
      <span className="shrink-0">· {entry.time}</span>
    </li>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function TaskChip({ task }: { task: MockTask }) {
  const scope = findScope(task.scopeId);
  return (
    <Link
      to="/modes/collaboration"
      search={{ view: "task", id: task.id }}
      className={cn(PROPERTY_ROW, "h-auto flex-col items-start gap-0 py-1")}
    >
      <span className="flex w-full min-w-0 items-center gap-1.5">
        <TaskStatusIcon status={task.status} className="size-3.5" />
        <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">
          {task.key}
        </span>
        <span className="min-w-0 truncate">{task.title}</span>
      </span>
      <span className="pl-5 text-[0.6875rem] text-muted-foreground">
        {task.status === "done" ? "Landed" : (scope?.name ?? "No horizon")}
      </span>
    </Link>
  );
}

export function TaskView({ task: selected }: { task: MockTask }) {
  const tasks = useTasks();
  const task = tasks.find((entry) => entry.id === selected.id) ?? selected;

  const project = findProject(task.projectId);
  const scope = findScope(task.scopeId);
  const children = taskChildren(task.id);
  const siblings = laneTasks(
    tasks,
    task.projectId,
    task.scopeId,
    task.parentId
  );
  const index = siblings.findIndex((entry) => entry.id === task.id);
  const previous = siblings[index - 1];
  const next = siblings[index + 1];

  const conflicts = conflictsFor(tasks, task);
  const waits = blockersOf(tasks, task);
  const blocks = blocking(tasks, task);
  const certainty = certaintyOf(tasks, task);
  const decision = nextDecision(tasks, task);
  const symptoms = symptomsOf(tasks, task);
  const cause =
    task.symptomOf === undefined ? undefined : findTask(task.symptomOf);
  const pace =
    task.assignee === VIEWER.name
      ? paceFor(tasks, task.assignee, task.labels)
      : undefined;

  return (
    <>
      <header className="order-last flex h-9 shrink-0 items-center gap-2 border-t px-3">
        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-1.5 text-[13px]"
        >
          <Link
            to="/modes/collaboration"
            search={{ view: "tasks", id: task.projectId }}
            className="flex min-w-0 items-center gap-1.5 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            <span
              className="size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)"
              style={{ "--mark": project?.color } as CSSProperties}
            />
            <span className="truncate">{project?.name}</span>
          </Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            {task.key}
          </span>
          <span className="truncate font-medium">{task.title}</span>
        </nav>
        <Button
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-muted-foreground"
          aria-label="Favorite this task"
        >
          <IconStar className="size-4" />
        </Button>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <span className="pr-1 text-xs text-muted-foreground tabular-nums">
            {index + 1} / {siblings.length}
          </span>
          {previous !== undefined && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Previous task"
              render={
                <Link
                  to="/modes/collaboration"
                  search={{ view: "task", id: previous.id }}
                />
              }
            >
              <IconChevronUp className="size-4" />
            </Button>
          )}
          {next !== undefined && (
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label="Next task"
              render={
                <Link
                  to="/modes/collaboration"
                  search={{ view: "task", id: next.id }}
                />
              }
            >
              <IconChevronDown className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground max-sm:hidden"
            aria-label="Copy link"
          >
            <IconLink className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground max-sm:hidden"
            aria-label="Copy branch name"
          >
            <IconGitBranch className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Task options">
            <IconDots className="size-4" />
          </Button>
        </div>
      </header>

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <div className="mx-auto flex w-full max-w-5xl gap-10 px-6 py-8 max-lg:flex-col max-lg:gap-8">
          <div className="min-w-0 flex-1">
            <h1 className="max-w-[50ch] text-xl font-semibold tracking-tight text-balance">
              {task.title}
            </h1>

            <div className="mt-3 flex max-w-[70ch] flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              <span
                className={cn(
                  "font-medium",
                  certainty === "unknown" &&
                    "text-violet-600 dark:text-violet-400"
                )}
              >
                {CERTAINTY_LABEL[certainty]}.
              </span>
              {certainty === "unknown" && decision !== undefined && (
                <span className="text-muted-foreground">
                  {decision.id === task.id ? (
                    "There is no date to give until it is worked out — only the date we will know one."
                  ) : (
                    <>
                      The answer arrives when{" "}
                      <Link
                        to="/modes/collaboration"
                        search={{ view: "task", id: decision.id }}
                        className="underline underline-offset-2"
                      >
                        {decision.key}
                      </Link>{" "}
                      stops being figured out.
                    </>
                  )}
                </span>
              )}
              {task.pushes > 0 && (
                <span className="text-muted-foreground">
                  Moved to a later horizon {task.pushes}{" "}
                  {task.pushes === 1 ? "time" : "times"}.
                </span>
              )}
              {growth(task) > 0 && (
                <span className="text-muted-foreground">
                  Grew {growth(task)} {growth(task) === 1 ? "time" : "times"}{" "}
                  since it was written.
                </span>
              )}
            </div>

            {cause !== undefined && (
              <p className="mt-3 max-w-[70ch] text-[13px] text-muted-foreground">
                A symptom of{" "}
                <Link
                  to="/modes/collaboration"
                  search={{ view: "task", id: cause.id }}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {cause.key} {cause.title}
                </Link>
                , which landed but did not finish.
              </p>
            )}

            {conflicts.map((conflict) => (
              <div
                key={conflict.blocker.id}
                className="mt-4 flex max-w-[70ch] items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2.5"
              >
                <IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="min-w-0 text-[13px]">
                  <p>
                    Planned for {scope?.name ?? "this horizon"}, waiting on{" "}
                    <Link
                      to="/modes/collaboration"
                      search={{ view: "task", id: conflict.blocker.id }}
                      className="font-medium underline underline-offset-2"
                    >
                      {conflict.blocker.key}
                    </Link>
                    {conflict.reason === "later-scope"
                      ? ` — which does not start until ${findScope(conflict.blocker.scopeId)?.name ?? "a later horizon"}.`
                      : " — which is further down this same horizon."}{" "}
                    This order cannot happen.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      announceMove(
                        moveTaskTo(
                          task.id,
                          conflict.blocker.scopeId,
                          laneTasks(
                            tasks,
                            task.projectId,
                            conflict.blocker.scopeId,
                            task.parentId
                          ).length
                        )
                      )
                    }
                    className="mt-1.5 rounded-md text-xs font-medium text-destructive underline underline-offset-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    Move it after {conflict.blocker.key}
                  </button>
                </div>
              </div>
            ))}

            <div className="mt-4 flex flex-col gap-3">
              {task.description.map((paragraph) => (
                <p
                  key={paragraph}
                  className="max-w-[70ch] text-sm text-pretty text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Add a reaction"
              >
                <IconMoodPlus className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Attach a file"
              >
                <IconPaperclip className="size-4" />
              </Button>
            </div>

            <div className="mt-6">
              {children.length > 0 && (
                <ul role="list" className="mb-1 flex flex-col">
                  {children.map((child) => (
                    <li key={child.id}>
                      <Link
                        to="/modes/collaboration"
                        search={{ view: "task", id: child.id }}
                        className="flex h-8 items-center gap-2.5 rounded-md px-1.5 text-[13px] outline-none hover:bg-elevate focus-visible:bg-elevate"
                      >
                        <TaskStatusIcon status={child.status} />
                        <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                          {child.key}
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {child.title}
                        </span>
                        <AssigneeAvatar name={child.assignee} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="flex h-8 items-center gap-1.5 rounded-md px-1.5 text-[13px] text-muted-foreground outline-none hover:bg-elevate hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <IconPlus className="size-4" />
                Add sub-issues
              </button>
            </div>

            <TaskDiscoveries task={task} />

            <div className="mt-8 border-t pt-6">
              <h2 className="text-sm font-medium">Activity</h2>
              <ul role="list" className="mt-3 flex flex-col gap-3">
                {task.activity.map((entry) => (
                  <ActivityEntry key={entry.id} entry={entry} />
                ))}
                {task.activity.length === 0 && (
                  <li className="px-1 text-[13px] text-muted-foreground">
                    Nothing has happened here yet.
                  </li>
                )}
              </ul>

              <div className="mt-3 flex items-center gap-2 rounded-xl border px-3 py-2">
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  placeholder="Leave a reply…"
                />
                <Button
                  size="icon-sm"
                  className="shrink-0 rounded-full"
                  aria-label="Send reply"
                >
                  <IconSend className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <aside className="flex w-60 shrink-0 flex-col gap-6 max-lg:w-full">
            <Property label="Status">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<button type="button" className={PROPERTY_ROW} />}
                >
                  <TaskStatusIcon status={task.status} />
                  {STATUS_LABEL[task.status]}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-64">
                  {STATUS_ORDER.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => setTaskStatus(task.id, status)}
                      className="items-start"
                    >
                      <TaskStatusIcon status={status} className="mt-0.5" />
                      <span className="flex min-w-0 flex-col">
                        <span>{STATUS_LABEL[status]}</span>
                        <span className="text-xs text-muted-foreground">
                          {STATUS_MEANING[status]}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </Property>

            <Property label="Horizon">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<button type="button" className={PROPERTY_ROW} />}
                >
                  {scope !== undefined && <ScopeGlyph kind={scope.kind} />}
                  <span className="min-w-0 truncate">
                    {scope?.name ?? "No horizon"}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-56">
                  {SCOPES.map((entry) => (
                    <DropdownMenuItem
                      key={entry.id}
                      onClick={() =>
                        announceMove(
                          moveTaskTo(
                            task.id,
                            entry.id,
                            laneTasks(
                              tasks,
                              task.projectId,
                              entry.id,
                              task.parentId
                            ).length
                          )
                        )
                      }
                      className="items-start"
                    >
                      <ScopeGlyph kind={entry.kind} className="mt-0.5" />
                      <span className="flex min-w-0 flex-col">
                        <span>{entry.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {entry.window}
                        </span>
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <p className="px-1.5 text-xs text-muted-foreground">
                {task.status === "done"
                  ? "Landed — out of the sequence."
                  : index < 0
                    ? "Not in the sequence."
                    : previous === undefined
                      ? `First in line, ${scope?.left ?? ""}`
                      : `After ${previous.key}, ${scope?.left ?? ""}`}
              </p>
            </Property>

            <Property label="Time">
              <div className={cn(PROPERTY_ROW, "gap-2 hover:bg-transparent")}>
                <TrackButton task={task} />
                <SpentLabel task={task} precise className="text-[13px]" />
                {task.spent === 0 && (
                  <span className="text-[13px] text-muted-foreground">
                    Nothing worked yet
                  </span>
                )}
                <span className="text-xs text-muted-foreground">worked</span>
              </div>
              {task.waited > 0 && (
                <div className={cn(PROPERTY_ROW, "gap-2 hover:bg-transparent")}>
                  <span className="grid size-6 place-items-center">
                    <IconHourglass className="size-3.5 text-muted-foreground" />
                  </span>
                  <span className="text-[13px] tabular-nums">
                    {formatWaited(task.waited)}
                  </span>
                  <span className="text-xs text-muted-foreground">waited</span>
                </div>
              )}
              <p className="px-1.5 text-xs text-pretty text-muted-foreground">
                {task.waited > 0
                  ? `${formatSpent(task.spent)} of work spread over ${formatWaited(task.waited)} of waiting. Only the first number is anybody's speed.`
                  : "Measured, never estimated. Rounded, because breaks and switches make the minutes a fiction."}
              </p>
              {pace !== undefined && (
                <p className="px-1.5 text-xs text-pretty text-muted-foreground">
                  Work you have labelled this way took you{" "}
                  {formatSpent(pace.low)}–{formatSpent(pace.high)} across{" "}
                  {pace.count} tasks. Only you see this.
                </p>
              )}
            </Property>

            <Property label="Assignee">
              {isUpForGrabs(tasks, task) ? (
                <div className={cn(PROPERTY_ROW, "gap-2 hover:bg-transparent")}>
                  <ClaimButton task={task} />
                  <span className="text-[13px] text-muted-foreground">
                    Up for grabs
                  </span>
                </div>
              ) : (
                <button type="button" className={PROPERTY_ROW}>
                  <AssigneeAvatar name={task.assignee} className="size-4" />
                  <span className="min-w-0 truncate">{task.assignee}</span>
                </button>
              )}
            </Property>

            {waits.length > 0 && (
              <Property label="Waits on">
                <div className="flex flex-col">
                  {waits.map((blocker) => (
                    <TaskChip key={blocker.id} task={blocker} />
                  ))}
                </div>
              </Property>
            )}

            {blocks.length > 0 && (
              <Property label="Blocks">
                <div className="flex flex-col">
                  {blocks.map((blocked) => (
                    <TaskChip key={blocked.id} task={blocked} />
                  ))}
                </div>
              </Property>
            )}

            {symptoms.length > 0 && (
              <Property label="Symptoms">
                <div className="flex flex-col">
                  {symptoms.map((symptom) => (
                    <TaskChip key={symptom.id} task={symptom} />
                  ))}
                </div>
                <p className="px-1.5 text-xs text-pretty text-muted-foreground">
                  {openSymptoms(tasks, task).length > 0
                    ? "Still producing symptoms, so this landed without finishing."
                    : "All of them closed."}
                </p>
              </Property>
            )}

            <Property label="Labels">
              <div className="flex flex-wrap items-center gap-1">
                {task.labels.map((label) => (
                  <span
                    key={label}
                    className="flex h-6 items-center rounded-full border px-2 text-xs text-muted-foreground"
                  >
                    {label}
                  </span>
                ))}
                <button
                  type="button"
                  className={cn(
                    PROPERTY_ROW,
                    "h-6 w-auto text-muted-foreground"
                  )}
                >
                  <IconTag className="size-4" />
                  Add label
                </button>
              </div>
            </Property>

            <Property label="Project">
              <Link
                to="/modes/collaboration"
                search={{ view: "project", id: task.projectId }}
                className={PROPERTY_ROW}
              >
                <span
                  className="size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)"
                  style={{ "--mark": project?.color } as CSSProperties}
                />
                <span className="min-w-0 truncate">{project?.name}</span>
              </Link>
            </Property>
          </aside>
        </div>
      </ScrollArea>
    </>
  );
}
