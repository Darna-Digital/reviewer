/**
 * Scope and sequence, worked out in one place.
 *
 * The rules the surfaces draw are all decidable from an array of tasks: which
 * horizon a task sits in, what position it holds there, and whether the plan it
 * describes is possible. That last one is the point of the model — a task that
 * waits on something scheduled after it is a plan that cannot happen, and
 * saying so is more useful than letting a "high priority" label imply it will.
 */
import {
  findScope,
  SCOPES,
  scopeRank,
  UNASSIGNED,
  type MockTask,
  type TaskStatus,
} from "@/interactions/collaboration/data/collaboration.mock";

/** Done work leaves the sequence — it already happened, so it holds no place. */
export const isOpen = (task: MockTask): boolean => task.status !== "done";

const sameLane = (
  task: MockTask,
  projectId: string,
  parentId: string | undefined,
  scopeId: string
) =>
  task.projectId === projectId &&
  task.parentId === parentId &&
  task.scopeId === scopeId;

/**
 * The tasks competing for a position: one project, one horizon, one level of
 * the tree. Sub-tasks sequence among themselves, so "first" means something at
 * every level rather than only at the top.
 */
export function laneTasks(
  tasks: ReadonlyArray<MockTask>,
  projectId: string,
  scopeId: string,
  parentId?: string
): ReadonlyArray<MockTask> {
  return tasks
    .filter(isOpen)
    .filter((task) => sameLane(task, projectId, parentId, scopeId))
    .sort((a, b) => a.sequence - b.sequence);
}

/** Everything open in a horizon, top level first and each parent's children after it. */
export function scopeTasks(
  tasks: ReadonlyArray<MockTask>,
  projectId: string,
  scopeId: string
): ReadonlyArray<MockTask> {
  return laneTasks(tasks, projectId, scopeId).flatMap((task) => [
    task,
    ...laneTasks(tasks, projectId, scopeId, task.id),
  ]);
}

/** Landed work, most recent first. What it cost is the only thing left to read. */
export function landedTasks(
  tasks: ReadonlyArray<MockTask>,
  projectId: string
): ReadonlyArray<MockTask> {
  return tasks.filter(
    (task) => task.projectId === projectId && task.status === "done"
  );
}

const renumber = (lane: ReadonlyArray<MockTask>): Map<string, number> =>
  new Map(lane.map((task, index) => [task.id, index + 1]));

/**
 * Drop a task into a horizon at a position, and renumber both lanes it touched.
 * Positions are never sparse afterwards, so "third" always means two things
 * come before it.
 */
export function moveTask(
  tasks: ReadonlyArray<MockTask>,
  taskId: string,
  scopeId: string,
  index: number
): ReadonlyArray<MockTask> {
  const moved = tasks.find((task) => task.id === taskId);
  if (moved === undefined) return tasks;

  const target = laneTasks(
    tasks,
    moved.projectId,
    scopeId,
    moved.parentId
  ).filter((task) => task.id !== taskId);
  const at = Math.max(0, Math.min(index, target.length));
  const ordered = [...target.slice(0, at), moved, ...target.slice(at)];

  const source =
    scopeId === moved.scopeId
      ? []
      : laneTasks(tasks, moved.projectId, moved.scopeId, moved.parentId).filter(
          (task) => task.id !== taskId
        );

  const sequences = new Map([...renumber(ordered), ...renumber(source)]);
  return tasks.map((task) => {
    const sequence = sequences.get(task.id);
    if (sequence === undefined) return task;
    return task.id === taskId
      ? { ...task, scopeId, sequence }
      : { ...task, sequence };
  });
}

/**
 * Why a blocker makes the plan impossible: it lives in a later horizon, or it
 * is further down the same one. A blocker that has already landed is neither.
 */
export type ConflictReason = "later-scope" | "later-in-lane";

export interface FlowConflict {
  blocker: MockTask;
  reason: ConflictReason;
}

export function conflictsFor(
  tasks: ReadonlyArray<MockTask>,
  task: MockTask
): ReadonlyArray<FlowConflict> {
  if (task.status === "done") return [];
  return blockersOf(tasks, task)
    .filter((blocker) => blocker.status !== "done")
    .map((blocker) => {
      if (scopeRank(blocker.scopeId) > scopeRank(task.scopeId)) {
        return { blocker, reason: "later-scope" as const };
      }
      if (
        blocker.scopeId === task.scopeId &&
        blocker.parentId === task.parentId &&
        blocker.sequence > task.sequence
      ) {
        return { blocker, reason: "later-in-lane" as const };
      }
      return null;
    })
    .filter((conflict) => conflict !== null);
}

export const blockersOf = (
  tasks: ReadonlyArray<MockTask>,
  task: MockTask
): ReadonlyArray<MockTask> =>
  task.blockedBy
    .map((id) => tasks.find((candidate) => candidate.id === id))
    .filter((blocker) => blocker !== undefined);

export const blocking = (
  tasks: ReadonlyArray<MockTask>,
  task: MockTask
): ReadonlyArray<MockTask> =>
  tasks.filter((candidate) => candidate.blockedBy.includes(task.id));

/**
 * The one thing that is first. Not the most important — the earliest position
 * in the nearest horizon, which is the only sense in which anything can be.
 */
export function firstThing(
  tasks: ReadonlyArray<MockTask>,
  projectId: string
): MockTask | undefined {
  return tasks
    .filter(isOpen)
    .filter(
      (task) =>
        task.projectId === projectId &&
        task.parentId === undefined &&
        task.scopeId !== "out"
    )
    .sort(
      (a, b) =>
        scopeRank(a.scopeId) - scopeRank(b.scopeId) || a.sequence - b.sequence
    )
    .at(0);
}

/**
 * Work anybody can take right now: nobody holds it, nothing it waits on is
 * outstanding, and it sits in a horizon somebody cares about. Availability is a
 * fact about the task, not a guess at how long it would take — the horizon it
 * is in already says how soon it matters.
 */
export function isUpForGrabs(
  tasks: ReadonlyArray<MockTask>,
  task: MockTask
): boolean {
  return (
    task.status !== "done" &&
    task.assignee === UNASSIGNED &&
    task.scopeId !== "out" &&
    blockersOf(tasks, task).every((blocker) => blocker.status === "done")
  );
}

export const upForGrabs = (
  tasks: ReadonlyArray<MockTask>,
  projectId: string
): ReadonlyArray<MockTask> =>
  tasks.filter(
    (task) => task.projectId === projectId && isUpForGrabs(tasks, task)
  );

/**
 * Horizons nest: today is inside this week, which is inside this month. So
 * "what will be done by the end of X" is everything in X and everything nearer
 * than X — which is why picking a horizon is a real question with a real answer
 * rather than a filter on a label.
 */
export const withinHorizon = (
  tasks: ReadonlyArray<MockTask>,
  scopeId: string
): ReadonlyArray<MockTask> =>
  tasks.filter(
    (task) =>
      task.scopeId !== "out" && scopeRank(task.scopeId) <= scopeRank(scopeId)
  );

export const beyondHorizon = (
  tasks: ReadonlyArray<MockTask>,
  scopeId: string
): ReadonlyArray<MockTask> =>
  tasks.filter(
    (task) =>
      task.scopeId !== "out" && scopeRank(task.scopeId) > scopeRank(scopeId)
  );

/**
 * What the horizon is actually made of. Everything here is a count of something
 * true right now — never a percentage, and never a forecast. The interesting
 * numbers are the uncomfortable ones: work nobody has worked out yet, work
 * nobody holds, and orders that cannot happen.
 */
export interface HorizonReading {
  total: number;
  landed: number;
  figuring: number;
  unclaimed: number;
  impossible: number;
  tracked: number;
  /** Things reality added to this plan after somebody wrote it down. */
  grown: number;
  /** Work that has already been moved to a later horizon at least twice. */
  pushed: number;
  /** Landed work still producing symptoms, which means it did not finish. */
  unfinished: number;
  waited: number;
}

export function readHorizon(
  tasks: ReadonlyArray<MockTask>,
  scopeId: string
): HorizonReading {
  const inside = withinHorizon(tasks, scopeId);
  return {
    total: inside.length,
    landed: inside.filter((task) => task.status === "done").length,
    figuring: inside.filter((task) => task.status === "figuring").length,
    unclaimed: inside.filter((task) => isUpForGrabs(tasks, task)).length,
    impossible: inside.filter((task) => conflictsFor(tasks, task).length > 0)
      .length,
    tracked: totalSpent(inside),
    grown: inside.reduce((sum, task) => sum + growth(task), 0),
    pushed: inside.filter((task) => task.pushes >= 2).length,
    unfinished: inside.filter(
      (task) => task.status === "done" && openSymptoms(tasks, task).length > 0
    ).length,
    waited: totalWaited(inside),
  };
}

export interface Displacement {
  task: MockTask;
  from: string;
  to: string;
}

export interface PushResult {
  tasks: ReadonlyArray<MockTask>;
  displaced: ReadonlyArray<Displacement>;
}

/**
 * The move that tells the truth about a full day.
 *
 * A horizon holds as many things as somebody said it holds — a decision, not a
 * prediction — so squeezing an urgent task in has to push the tail of that lane
 * into the next horizon, which can push its own tail further still. The chain
 * is the point: pulling something forward is never free, and this is where a
 * priority label quietly lies by letting everything stay where it was.
 */
export function pushInto(
  tasks: ReadonlyArray<MockTask>,
  taskId: string,
  scopeId: string,
  index: number
): PushResult {
  const placed = moveTask(tasks, taskId, scopeId, index);
  const moved = placed.find((task) => task.id === taskId);
  if (placed === tasks || moved === undefined) {
    return { tasks, displaced: [] };
  }

  const displaced: Array<Displacement> = [];
  let next = placed;
  let scope = scopeId;
  let keepId = taskId;

  // A spill only ever moves outward, so the chain cannot be longer than the
  // horizons themselves.
  let remaining = SCOPES.length;
  while (remaining > 0) {
    remaining -= 1;
    const capacity = findScope(scope)?.capacity;
    if (capacity === null || capacity === undefined) break;
    const lane = laneTasks(next, moved.projectId, scope);
    if (lane.length <= capacity) break;

    // The newcomer keeps the place it was dropped in; the tail behind it goes.
    const spilled = [...lane].reverse().find((task) => task.id !== keepId);
    const onward = SCOPES[scopeRank(scope) + 1];
    if (spilled === undefined || onward === undefined) break;

    next = moveTask(
      next,
      spilled.id,
      onward.id,
      laneTasks(next, moved.projectId, onward.id).length
    );
    displaced.push({ task: spilled, from: scope, to: onward.id });
    scope = onward.id;
    keepId = spilled.id;
  }

  return { tasks: next, displaced };
}

/**
 * How much bigger a task turned out to be than it was when somebody wrote it
 * down. Not a percentage against an estimate that never existed — a count of
 * the times reality added something.
 */
export const growth = (task: MockTask): number =>
  task.discoveries.filter((entry) => entry.effect !== "question").length;

export const openQuestions = (task: MockTask): number =>
  task.discoveries.filter((entry) => entry.effect === "question").length;

export const symptomsOf = (
  tasks: ReadonlyArray<MockTask>,
  task: MockTask
): ReadonlyArray<MockTask> =>
  tasks.filter((candidate) => candidate.symptomOf === task.id);

/**
 * Landing is not the same as being done. A task that keeps producing symptoms
 * was a feature somebody stopped working on, not a feature that finished.
 */
export const openSymptoms = (
  tasks: ReadonlyArray<MockTask>,
  task: MockTask
): ReadonlyArray<MockTask> =>
  symptomsOf(tasks, task).filter((symptom) => symptom.status !== "done");

/**
 * How much can honestly be said about a task. Deliberately not a percentage and
 * deliberately not a date: the useful distinction is whether anybody has worked
 * the thing out yet, because everything downstream of that is a guess.
 */
export type Certainty = "unknown" | "waiting" | "moving" | "ready" | "landed";

export const CERTAINTY_LABEL: Record<Certainty, string> = {
  unknown: "Nobody has worked this out yet",
  waiting: "Worked out, waiting on something else",
  moving: "Under way",
  ready: "Worked out, nobody has started",
  landed: "Landed",
};

export function certaintyOf(
  tasks: ReadonlyArray<MockTask>,
  task: MockTask
): Certainty {
  if (task.status === "done") return "landed";
  const blockers = blockersOf(tasks, task).filter(
    (blocker) => blocker.status !== "done"
  );
  if (task.status === "figuring") return "unknown";
  if (blockers.some((blocker) => blocker.status === "figuring")) {
    return "unknown";
  }
  if (blockers.length > 0) return "waiting";
  if (task.status === "doing" || task.status === "review") return "moving";
  return "ready";
}

/**
 * The question a plan can actually answer. "When will it be done" has no honest
 * answer while something is still being figured out — but "when will we know"
 * does, and it points at the specific thing that has to be decided first.
 */
export function nextDecision(
  tasks: ReadonlyArray<MockTask>,
  task: MockTask
): MockTask | undefined {
  if (task.status === "figuring") return task;
  return blockersOf(tasks, task).find(
    (blocker) => blocker.status === "figuring"
  );
}

export interface Pace {
  low: number;
  high: number;
  count: number;
}

/**
 * What work like this has cost this person before — their own actuals, never
 * anybody else's, and never a number to hold them to. Two samples is the floor,
 * because one is an anecdote.
 */
export function paceFor(
  tasks: ReadonlyArray<MockTask>,
  person: string,
  labels: ReadonlyArray<string>
): Pace | undefined {
  const like = tasks.filter(
    (task) =>
      task.status === "done" &&
      task.assignee === person &&
      task.spent > 0 &&
      task.labels.some((label) => labels.includes(label))
  );
  if (like.length < 2) return undefined;
  const spent = like.map((task) => task.spent);
  return {
    low: Math.min(...spent),
    high: Math.max(...spent),
    count: like.length,
  };
}

/** Tracked minutes, as somebody would say them. Never a fraction of anything. */
export function formatSpent(minutes: number): string {
  if (minutes <= 0) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * Time as somebody remembers it rather than as a stopwatch recorded it. Breaks
 * and context switches make the minutes a fiction, so anywhere the number is
 * not the point it is rounded until it stops pretending to be exact.
 */
export function formatRough(minutes: number): string {
  if (minutes <= 0) return "—";
  if (minutes < 45) return "~30m";
  const hours = minutes / 60;
  if (hours < 2) return `~${(Math.round(hours * 2) / 2).toString()}h`;
  if (hours < 8) return `~${Math.round(hours)}h`;
  const days = Math.round(hours / 8);
  return days === 1 ? "~a day" : `~${days}d`;
}

/** Waiting is measured in days off, because that is how it is felt. */
export function formatWaited(minutes: number): string {
  if (minutes <= 0) return "—";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

export const totalSpent = (tasks: ReadonlyArray<MockTask>): number =>
  tasks.reduce((sum, task) => sum + task.spent, 0);

export const totalWaited = (tasks: ReadonlyArray<MockTask>): number =>
  tasks.reduce((sum, task) => sum + task.waited, 0);

/** A count of things in a state is a fact. It is never called progress. */
export function countByStatus(
  tasks: ReadonlyArray<MockTask>
): ReadonlyArray<{ status: TaskStatus; count: number }> {
  const counts = new Map<TaskStatus, number>();
  for (const task of tasks) {
    counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
  }
  return [...counts].map(([status, count]) => ({ status, count }));
}
