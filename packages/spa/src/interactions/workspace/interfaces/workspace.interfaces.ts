/**
 * `workspace` feature — the issue list's shaping rules.
 *
 * What the list shows is not a straight render of what the server returned: it
 * is filtered by a search box and a label picker, grouped by status, nested by
 * parent, and then flattened back into rows so the whole thing can be one
 * scrollable list rather than a tree of nested scroll containers. All of that
 * is arithmetic over data, so it lives here as pure functions and the
 * components stay declarative.
 */
import type { Label } from "@byconvo/core/labels"
import type { Task, TaskStatus } from "@byconvo/core/tasks"

export interface IssueFilters {
  readonly search: string
  /** Every selected label must be present (an AND filter). */
  readonly labelIds: ReadonlyArray<string>
  /** Statuses hidden by the view's own toggles, e.g. "hide completed". */
  readonly hiddenStatuses: ReadonlyArray<TaskStatus>
}

export const noFilters: IssueFilters = {
  search: "",
  labelIds: [],
  hiddenStatuses: [],
}

/** One rendered line of the issue list, flattened out of the parent tree. */
export interface IssueRow {
  readonly task: Task
  /** 0 at the top level; each sub-issue generation adds one. */
  readonly depth: number
  readonly hasChildren: boolean
  readonly expanded: boolean
}

export interface IssueGroup {
  readonly status: TaskStatus
  readonly label: string
  /** Every issue in the group, including collapsed sub-issues. */
  readonly count: number
  readonly rows: ReadonlyArray<IssueRow>
}

export interface WorkspaceDependencies {
  data: {
    readonly tasks: ReadonlyArray<Task>
    readonly labels: ReadonlyArray<Label>
    readonly filters: IssueFilters
    /** Ids of issues whose sub-issues are showing. */
    readonly expanded: ReadonlySet<string>
  }
  sideEffects: {
    readonly create: (input: {
      title: string
      status: TaskStatus
      parentId: string | null
    }) => Promise<void>
    readonly update: (id: string, input: Partial<Task>) => Promise<void>
    readonly move: (
      id: string,
      status: TaskStatus,
      index: number
    ) => Promise<void>
    readonly remove: (id: string) => Promise<void>
  }
}

export interface WorkspaceFunctions {
  /** The list, as the screen renders it: filtered, grouped, nested, flat. */
  readonly groups: () => ReadonlyArray<IssueGroup>
  /** The labels behind a task's ids, in display order. */
  readonly labelsOf: (task: Task) => ReadonlyArray<Label>
  /** Direct sub-issues of a task, ordered — for the detail pane's list. */
  readonly childrenOf: (id: string) => ReadonlyArray<Task>
  /**
   * Create an issue; resolves to false when the title is blank, so the
   * composer can keep focus instead of clearing itself.
   */
  readonly create: (
    title: string,
    status: TaskStatus,
    parentId?: string | null
  ) => Promise<boolean>
  readonly setStatus: (task: Task, status: TaskStatus) => Promise<void>
  readonly setPriority: (
    task: Task,
    priority: Task["priority"]
  ) => Promise<void>
  readonly toggleLabel: (task: Task, labelId: string) => Promise<void>
  readonly rename: (task: Task, title: string) => Promise<void>
  readonly remove: (id: string) => Promise<void>
}
