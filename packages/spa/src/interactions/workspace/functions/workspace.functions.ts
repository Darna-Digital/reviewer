import { labelsForIds } from "@byconvo/core/labels"
import {
  STATUS_LABEL,
  STATUS_ORDER,
  buildTaskTree,
  filterByLabels,
  searchTasks,
  sortTasks,
  type Task,
  type TaskNode,
} from "@byconvo/core/tasks"
import type {
  IssueGroup,
  IssueRow,
  WorkspaceDependencies,
  WorkspaceFunctions,
} from "../interfaces/workspace.interfaces"

/** Walk a tree into rows, stopping at any node the reader has collapsed. */
const flatten = (
  nodes: ReadonlyArray<TaskNode>,
  expanded: ReadonlySet<string>,
  depth: number,
  rows: Array<IssueRow>
): void => {
  for (const node of nodes) {
    const hasChildren = node.children.length > 0
    const isExpanded = hasChildren && expanded.has(node.task.id)
    rows.push({ task: node.task, depth, hasChildren, expanded: isExpanded })
    if (isExpanded) flatten(node.children, expanded, depth + 1, rows)
  }
}

/**
 * Everything in the tree, collapsed or not — a group header reading "Todo 14"
 * must not drop to 12 because someone folded a sub-issue away.
 */
const countTree = (nodes: ReadonlyArray<TaskNode>): number =>
  nodes.reduce((total, node) => total + 1 + countTree(node.children), 0)

export function createWorkspaceFunctions(
  d: WorkspaceDependencies
): WorkspaceFunctions {
  const groups: WorkspaceFunctions["groups"] = () => {
    const { tasks, filters, expanded } = d.data
    const matching = searchTasks(
      filterByLabels(tasks, filters.labelIds),
      filters.search
    )
    const hidden = new Set(filters.hiddenStatuses)

    const result: Array<IssueGroup> = []
    for (const status of STATUS_ORDER) {
      if (hidden.has(status)) continue
      const inStatus = matching.filter((task) => task.status === status)
      if (inStatus.length === 0) continue

      // Nest within the status, not across it: an issue whose parent sits in
      // another column belongs at the top level of its own.
      const tree = buildTaskTree(inStatus)
      const rows: Array<IssueRow> = []
      flatten(tree, expanded, 0, rows)
      result.push({
        status,
        label: STATUS_LABEL[status],
        count: countTree(tree),
        rows,
      })
    }
    return result
  }

  const labelsOf: WorkspaceFunctions["labelsOf"] = (task) =>
    labelsForIds(d.data.labels, task.labelIds)

  const childrenOf: WorkspaceFunctions["childrenOf"] = (id) =>
    sortTasks(d.data.tasks.filter((task) => task.parentId === id))

  const create: WorkspaceFunctions["create"] = async (
    title,
    status,
    parentId = null
  ) => {
    const trimmed = title.trim()
    if (trimmed.length === 0) return false
    await d.sideEffects.create({ title: trimmed, status, parentId })
    return true
  }

  const setStatus: WorkspaceFunctions["setStatus"] = async (task, status) => {
    if (task.status === status) return
    await d.sideEffects.update(task.id, { status })
  }

  const setPriority: WorkspaceFunctions["setPriority"] = async (
    task,
    priority
  ) => {
    if (task.priority === priority) return
    await d.sideEffects.update(task.id, { priority })
  }

  const toggleLabel: WorkspaceFunctions["toggleLabel"] = async (
    task,
    labelId
  ) => {
    const labelIds = task.labelIds.includes(labelId)
      ? task.labelIds.filter((id) => id !== labelId)
      : [...task.labelIds, labelId]
    await d.sideEffects.update(task.id, { labelIds })
  }

  const rename: WorkspaceFunctions["rename"] = async (task, title) => {
    const trimmed = title.trim()
    if (trimmed.length === 0 || trimmed === task.title) return
    await d.sideEffects.update(task.id, { title: trimmed })
  }

  return {
    groups,
    labelsOf,
    childrenOf,
    create,
    setStatus,
    setPriority,
    toggleLabel,
    rename,
    remove: (id) => d.sideEffects.remove(id),
  }
}

/**
 * Where a drop lands. The list is flat, so a drag reports the row it was
 * released on; the column's own ordering is what the server needs, and the
 * moved issue has to be taken out of that ordering before its new index is
 * read off — otherwise dragging an issue one place down puts it back where it
 * started.
 */
export const dropIndexWithin = (
  column: ReadonlyArray<Task>,
  movedId: string,
  targetIndex: number
): number => {
  const without = column.filter((task) => task.id !== movedId)
  const clamped = Math.max(0, Math.min(targetIndex, without.length))
  return clamped
}
