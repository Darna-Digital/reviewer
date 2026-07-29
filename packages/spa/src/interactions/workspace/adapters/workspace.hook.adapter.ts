/**
 * Wires the workspace's TanStack DB collections into the shaping logic.
 *
 * Reads go through `useLiveQuery`, so a component re-renders when the store
 * changes and not when a request finishes. Writes go through the collection's
 * own `insert`/`update`/`delete`, which apply locally first and roll back if
 * the server refuses — which is why these handlers surface a failure as a
 * toast rather than by reverting anything themselves.
 */
import { eq, useLiveQuery } from "@tanstack/react-db"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"
import type { Task } from "@byconvo/core/tasks"
import { centralClient, unwrap } from "@/lib/central/client"
import {
  labelsCollection,
  projectsCollection,
  tasksCollection,
} from "@/lib/central/collections"
import { createWorkspaceFunctions } from "../functions/workspace.functions"
import {
  noFilters,
  type IssueFilters,
  type WorkspaceFunctions,
} from "../interfaces/workspace.interfaces"

/** Report a rejected optimistic write; the store has already rolled back. */
const reportFailure = (error: unknown, fallback: string) => {
  toast.error(error instanceof Error ? error.message : fallback)
}

export function useProjects() {
  const { data, isLoading, isError } = useLiveQuery((q) =>
    q.from({ project: projectsCollection() })
  )
  return { projects: data ?? [], isLoading, isError }
}

export function useProject(projectId: string | null) {
  const { data } = useLiveQuery(
    (q) =>
      projectId === null
        ? null
        : q
            .from({ project: projectsCollection() })
            .where(({ project }) => eq(project.id, projectId))
            .findOne(),
    [projectId]
  )
  return data ?? null
}

export interface WorkspaceIssuesOptions {
  readonly projectId: string
}

/**
 * Everything the issue list needs: the shaped groups, the filter state that
 * shapes them, the expand/collapse state, and the mutations. One hook because
 * they are one screen — splitting them would mean threading the same filters
 * and the same collection through four call sites.
 */
export function useWorkspaceIssues({ projectId }: WorkspaceIssuesOptions) {
  const tasks = tasksCollection(projectId)
  const labels = labelsCollection(projectId)

  const issues = useLiveQuery((q) => q.from({ task: tasks }), [projectId])
  const labelRows = useLiveQuery((q) => q.from({ label: labels }), [projectId])

  const [filters, setFilters] = useState<IssueFilters>(noFilters)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())

  const toggleExpanded = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const fns: WorkspaceFunctions = useMemo(
    () =>
      createWorkspaceFunctions({
        data: {
          tasks: issues.data ?? [],
          labels: labelRows.data ?? [],
          filters,
          expanded,
        },
        sideEffects: {
          create: async (input) => {
            // The server assigns the number, key and position; this row is a
            // placeholder the refetch replaces.
            tasks.insert({
              id: `pending-${crypto.randomUUID()}`,
              projectId,
              number: 0,
              key: "…",
              title: input.title,
              description: "",
              status: input.status,
              priority: "none",
              parentId: input.parentId,
              position: Number.MAX_SAFE_INTEGER,
              labelIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              completedAt: null,
            } satisfies Task)
          },
          update: async (id, input) => {
            tasks.update(id, (draft) => {
              Object.assign(draft, input)
            })
          },
          move: async (id, status, index) => {
            // Ordering is the server's to compute — it holds the neighbours'
            // fractional positions — so a drag is a plain call, not a local edit.
            unwrap(
              await centralClient.POST("/api/tasks/{id}/move", {
                params: { path: { id } },
                body: { status, index },
              }),
              "could not move the issue"
            )
            await tasks.utils.refetch()
          },
          remove: async (id) => {
            tasks.delete(id)
          },
        },
      }),
    [issues.data, labelRows.data, filters, expanded, tasks, projectId]
  )

  const guard = useCallback(
    <A extends ReadonlyArray<unknown>>(
      run: (...args: A) => Promise<unknown>,
      fallback: string
    ) =>
      (...args: A) => {
        void run(...args).catch((error: unknown) =>
          reportFailure(error, fallback)
        )
      },
    []
  )

  return {
    groups: fns.groups(),
    tasks: issues.data ?? [],
    labels: labelRows.data ?? [],
    isLoading: issues.isLoading,
    filters,
    setFilters,
    expanded,
    toggleExpanded,
    labelsOf: fns.labelsOf,
    childrenOf: fns.childrenOf,
    create: fns.create,
    setStatus: guard(fns.setStatus, "could not change the status"),
    setPriority: guard(fns.setPriority, "could not change the priority"),
    describe: guard(async (task: Task, description: string) => {
      if (task.description === description) return
      tasks.update(task.id, (draft) => {
        draft.description = description
      })
    }, "could not save the description"),
    toggleLabel: guard(fns.toggleLabel, "could not change the labels"),
    rename: guard(fns.rename, "could not rename the issue"),
    remove: guard(fns.remove, "could not delete the issue"),
  }
}

/** One issue, live — the detail pane re-renders with the list, not after it. */
export function useIssue(projectId: string, taskId: string | null) {
  const tasks = tasksCollection(projectId)
  const { data } = useLiveQuery(
    (q) =>
      taskId === null
        ? null
        : q
            .from({ task: tasks })
            .where(({ task }) => eq(task.id, taskId))
            .findOne(),
    [taskId, projectId]
  )
  return data ?? null
}
