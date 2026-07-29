import type { Label } from "@byconvo/core/labels"
import type { Task } from "@byconvo/core/tasks"
import {
  noFilters,
  type IssueFilters,
  type WorkspaceDependencies,
} from "../interfaces/workspace.interfaces"

export const task = (over: Partial<Task> & { id: string }): Task => ({
  projectId: "p1",
  number: 1,
  key: "BYC-1",
  title: "A task",
  description: "",
  status: "todo",
  priority: "none",
  parentId: null,
  position: 1024,
  labelIds: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
  ...over,
})

export const label = (over: Partial<Label> & { id: string }): Label => ({
  projectId: "p1",
  name: "ui/ux",
  color: "blue",
  createdAt: "2026-01-01T00:00:00.000Z",
  ...over,
})

export function mockWorkspaceDependencies(
  options: {
    tasks?: ReadonlyArray<Task>
    labels?: ReadonlyArray<Label>
    filters?: Partial<IssueFilters>
    expanded?: ReadonlyArray<string>
  } = {}
) {
  const calls = {
    create: [] as Array<{
      title: string
      status: string
      parentId: string | null
    }>,
    update: [] as Array<{ id: string; input: Partial<Task> }>,
    move: [] as Array<{ id: string; status: string; index: number }>,
    remove: [] as Array<string>,
  }

  const deps: WorkspaceDependencies = {
    data: {
      tasks: options.tasks ?? [],
      labels: options.labels ?? [],
      filters: { ...noFilters, ...options.filters },
      expanded: new Set(options.expanded ?? []),
    },
    sideEffects: {
      create: async (input) => {
        calls.create.push(input)
      },
      update: async (id, input) => {
        calls.update.push({ id, input })
      },
      move: async (id, status, index) => {
        calls.move.push({ id, status, index })
      },
      remove: async (id) => {
        calls.remove.push(id)
      },
    },
  }

  return { deps, calls }
}
