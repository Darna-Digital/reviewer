import type {
  Task,
  TaskPriority,
  TaskStatus,
} from "../schema/tasks.schema.ts"

/**
 * Board order, top to bottom. In-flight work first, then what is queued, then
 * what is finished — the shape the issue list groups by.
 */
export const STATUS_ORDER: ReadonlyArray<TaskStatus> = [
  "in_progress",
  "in_review",
  "paused",
  "todo",
  "backlog",
  "done",
  "canceled",
]

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  paused: "Paused",
  done: "Done",
  canceled: "Canceled",
}

/** Statuses that close a task — the ones that stamp `completedAt`. */
export const CLOSED_STATUSES: ReadonlyArray<TaskStatus> = ["done", "canceled"]

export const isClosed = (status: TaskStatus): boolean =>
  CLOSED_STATUSES.includes(status)

/** Most urgent first, which is also the order the priority picker lists. */
export const PRIORITY_ORDER: ReadonlyArray<TaskPriority> = [
  "urgent",
  "high",
  "medium",
  "low",
  "none",
]

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
}

const PRIORITY_RANK: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
}

export const taskKey = (projectKey: string, number: number): string =>
  `${projectKey}-${number}`

/** Split "BYC-224" back into its parts; null when it is not a task key. */
export const parseTaskKey = (
  key: string
): { readonly projectKey: string; readonly number: number } | null => {
  const match = /^([a-z][a-z0-9]*)-(\d+)$/i.exec(key.trim())
  if (match === null) return null
  return { projectKey: match[1]!.toUpperCase(), number: Number(match[2]) }
}

/** The gap left between neighbours, so ~50 inserts fit before a rebalance. */
const POSITION_STEP = 1024

/**
 * A sort key strictly between two neighbours. `null` stands for "no neighbour
 * on that side", so dropping at either end of a column stays one write instead
 * of renumbering everything below it.
 */
export const positionBetween = (
  before: number | null,
  after: number | null
): number => {
  if (before === null && after === null) return POSITION_STEP
  if (before === null) return after! - POSITION_STEP
  if (after === null) return before + POSITION_STEP
  return (before + after) / 2
}

/** The sort key for a task appended to the end of `siblings`. */
export const nextPosition = (siblings: ReadonlyArray<Task>): number =>
  positionBetween(
    siblings.reduce<number | null>(
      (max, task) => (max === null || task.position > max ? task.position : max),
      null
    ),
    null
  )

/**
 * The sort key for dropping a task at `index` within `ordered` — the list as it
 * reads *without* the task being moved. Callers filter the moved task out
 * first, so a within-column move and a cross-column move share one code path.
 */
export const positionForIndex = (
  ordered: ReadonlyArray<Task>,
  index: number
): number =>
  positionBetween(
    ordered[index - 1]?.position ?? null,
    ordered[index]?.position ?? null
  )

const byPosition = (a: Task, b: Task): number =>
  a.position - b.position || a.number - b.number

export const sortTasks = (tasks: ReadonlyArray<Task>): ReadonlyArray<Task> =>
  [...tasks].sort(byPosition)

/** Most urgent first, then by board position — the list's default order. */
export const sortByPriority = (
  tasks: ReadonlyArray<Task>
): ReadonlyArray<Task> =>
  [...tasks].sort(
    (a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byPosition(a, b)
  )

export interface StatusGroup {
  readonly status: TaskStatus
  readonly label: string
  readonly tasks: ReadonlyArray<Task>
}

/**
 * The issue list's spine: tasks bucketed into {@link STATUS_ORDER}, each bucket
 * sorted by position. Empty statuses are dropped unless `includeEmpty` asks for
 * them (the board wants every column; the list only wants the ones with work).
 */
export const groupByStatus = (
  tasks: ReadonlyArray<Task>,
  includeEmpty = false
): ReadonlyArray<StatusGroup> =>
  STATUS_ORDER.map((status) => ({
    status,
    label: STATUS_LABEL[status],
    tasks: sortTasks(tasks.filter((task) => task.status === status)),
  })).filter((group) => includeEmpty || group.tasks.length > 0)

export interface TaskNode {
  readonly task: Task
  readonly children: ReadonlyArray<TaskNode>
}

/**
 * Nest sub-tasks under their parents, one level of recursion per generation.
 * A task whose parent is not in `tasks` (filtered out, or in another project)
 * is promoted to the top level rather than dropped — the list must never lose
 * a row just because its parent is off-screen.
 */
export const buildTaskTree = (
  tasks: ReadonlyArray<Task>
): ReadonlyArray<TaskNode> => {
  const present = new Set(tasks.map((task) => task.id))
  const childrenOf = new Map<string, Array<Task>>()
  const roots: Array<Task> = []

  for (const task of tasks) {
    const parentId = task.parentId
    if (parentId !== null && present.has(parentId)) {
      const siblings = childrenOf.get(parentId)
      if (siblings === undefined) childrenOf.set(parentId, [task])
      else siblings.push(task)
    } else {
      roots.push(task)
    }
  }

  const build = (task: Task): TaskNode => ({
    task,
    children: sortTasks(childrenOf.get(task.id) ?? []).map(build),
  })

  return sortTasks(roots).map(build)
}

/** Every descendant of `id`, so deleting or moving a parent can carry them. */
export const descendantIds = (
  tasks: ReadonlyArray<Task>,
  id: string
): ReadonlyArray<string> => {
  const found: Array<string> = []
  const walk = (parentId: string) => {
    for (const task of tasks) {
      if (task.parentId === parentId && !found.includes(task.id)) {
        found.push(task.id)
        walk(task.id)
      }
    }
  }
  walk(id)
  return found
}

/**
 * Would re-parenting `id` under `parentId` create a cycle? True when the new
 * parent is the task itself or one of its own descendants.
 */
export const wouldCycle = (
  tasks: ReadonlyArray<Task>,
  id: string,
  parentId: string | null
): boolean =>
  parentId !== null &&
  (parentId === id || descendantIds(tasks, id).includes(parentId))

const KEY_IN_TEXT = /[a-z][a-z0-9]*-\d+/i

/**
 * Resolve a free-form reference to one task, for agents handed a sentence
 * rather than an id: an exact key, a key embedded in a phrase, an exact title,
 * a title quoted inside a longer instruction, then a substring match.
 */
export const resolveTaskRef = (
  tasks: ReadonlyArray<Task>,
  query: string
): Task | null => {
  const q = query.trim()
  if (q.length === 0) return null
  const lower = q.toLowerCase()

  const byKey = tasks.find((t) => t.key.toLowerCase() === lower)
  if (byKey !== undefined) return byKey

  const embedded = KEY_IN_TEXT.exec(q)?.[0]
  if (embedded !== undefined) {
    const byEmbedded = tasks.find(
      (t) => t.key.toLowerCase() === embedded.toLowerCase()
    )
    if (byEmbedded !== undefined) return byEmbedded
  }

  const byTitle = tasks.find((t) => t.title.trim().toLowerCase() === lower)
  if (byTitle !== undefined) return byTitle

  const titleInPhrase = tasks
    .filter(
      (t) =>
        t.title.trim().length > 0 && lower.includes(t.title.trim().toLowerCase())
    )
    .sort((a, b) => b.title.length - a.title.length)
  if (titleInPhrase.length > 0) return titleInPhrase[0]!

  const queryInTitle = tasks
    .filter((t) => t.title.toLowerCase().includes(lower))
    .sort((a, b) => a.title.length - b.title.length)
  return queryInTitle[0] ?? null
}

/**
 * Filter for the list's search box: match a task's key or title, and keep a
 * matched task's ancestors so the hit is still reachable through the tree.
 */
export const searchTasks = (
  tasks: ReadonlyArray<Task>,
  query: string
): ReadonlyArray<Task> => {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return tasks

  const byId = new Map(tasks.map((task) => [task.id, task]))
  const keep = new Set<string>()

  for (const task of tasks) {
    if (
      !task.key.toLowerCase().includes(q) &&
      !task.title.toLowerCase().includes(q)
    ) {
      continue
    }
    keep.add(task.id)
    let parentId = task.parentId
    while (parentId !== null && !keep.has(parentId)) {
      keep.add(parentId)
      parentId = byId.get(parentId)?.parentId ?? null
    }
  }

  return tasks.filter((task) => keep.has(task.id))
}

/** Keep only tasks carrying every one of `labelIds` (an AND filter). */
export const filterByLabels = (
  tasks: ReadonlyArray<Task>,
  labelIds: ReadonlyArray<string>
): ReadonlyArray<Task> =>
  labelIds.length === 0
    ? tasks
    : tasks.filter((task) =>
        labelIds.every((id) => task.labelIds.includes(id))
      )
