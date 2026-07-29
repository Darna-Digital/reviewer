/**
 * The workspace's client-side store, built on TanStack DB.
 *
 * The point of it here is latency. A workspace is a lot of small edits — retitle
 * an issue, drag it to another column, tick a label — and each one used to mean
 * a mutation, an invalidate, a refetch and a re-render before the screen agreed
 * with the pointer. A DB collection applies the change locally the moment it is
 * made, runs the write in the background, and rolls the local change back if
 * the server refuses it. Live queries then read straight out of that store, so
 * a change shows everywhere it appears at once — the list, the detail pane, the
 * sub-issue count — without any of them re-fetching.
 *
 * Collections are keyed by what scopes them (project, or comment subject) and
 * cached, because a TanStack DB collection is a live object, not a hook result:
 * building a new one per render would throw the local state away every time.
 */
import { QueryClient } from "@tanstack/react-query"
import { createCollection } from "@tanstack/react-db"
import { queryCollectionOptions } from "@tanstack/query-db-collection"
import type { Doc, DocSummary } from "@byconvo/core/docs"
import type { Label } from "@byconvo/core/labels"
import type { Project } from "@byconvo/core/projects"
import type { Task } from "@byconvo/core/tasks"
import type {
  CommentSubject,
  WorkspaceComment,
} from "@byconvo/core/workspace-comments"
import { centralClient, unwrap } from "./client"

/**
 * A cache of its own, separate from the git-review one: the workspace's data
 * has a different lifetime (it survives switching repository, and is thrown
 * away when the organization changes) and should not share invalidation with
 * anything reading this machine's checkout.
 */
export const workspaceQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The collection is the source of truth between refetches; re-reading on
      // every mount would fight the optimistic state it already holds.
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

const withKey = <K extends string, V>(): Map<K, V> => new Map<K, V>()

/**
 * The fields of a local change that the server will actually accept. A
 * collection's `changes` covers the whole row — including the id, the key and
 * the timestamps the server owns — so a PATCH body is picked from it rather
 * than passed through, and the pick is what the endpoint's own type checks.
 */
const pick = <T extends object, K extends keyof T>(
  source: T,
  keys: ReadonlyArray<K>
): Partial<Pick<T, K>> => {
  const picked: Partial<Pick<T, K>> = {}
  for (const key of keys) {
    if (source[key] !== undefined) picked[key] = source[key]
  }
  return picked
}

// --- projects --------------------------------------------------------------

const makeProjectsCollection = () =>
  createCollection(
    queryCollectionOptions({
      queryKey: ["central", "projects"],
      queryClient: workspaceQueryClient,
      getKey: (project) => project.id,
      queryFn: async () =>
        unwrap(
          await centralClient.GET("/api/projects"),
          "could not load projects"
        ) as Array<Project>,
      onInsert: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.POST("/api/projects", {
              body: {
                name: mutation.modified.name,
                key: mutation.modified.key,
                description: mutation.modified.description,
                color: mutation.modified.color,
              },
            }),
            "could not create the project"
          )
        }
      },
      onUpdate: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.PATCH("/api/projects/{id}", {
              params: { path: { id: mutation.key } },
              body: pick(mutation.changes, [
                "name",
                "key",
                "description",
                "color",
                "archived",
              ]),
            }),
            "could not save the project"
          )
        }
      },
      onDelete: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.DELETE("/api/projects/{id}", {
              params: { path: { id: mutation.key } },
            }),
            "could not delete the project"
          )
        }
      },
    })
  )

export type ProjectsCollection = ReturnType<typeof makeProjectsCollection>

let projects: ProjectsCollection | null = null

export const projectsCollection = (): ProjectsCollection =>
  (projects ??= makeProjectsCollection())

// --- tasks -----------------------------------------------------------------

const makeTasksCollection = (projectId: string) =>
  createCollection(
    queryCollectionOptions({
      queryKey: ["central", "tasks", projectId],
      queryClient: workspaceQueryClient,
      getKey: (task) => task.id,
      queryFn: async () =>
        unwrap(
          await centralClient.GET("/api/tasks", {
            params: { query: { projectId } },
          }),
          "could not load issues"
        ) as Array<Task>,
      onInsert: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          const task = mutation.modified
          unwrap(
            await centralClient.POST("/api/tasks", {
              body: {
                projectId,
                title: task.title,
                description: task.description,
                status: task.status,
                priority: task.priority,
                parentId: task.parentId,
                labelIds: [...task.labelIds],
              },
            }),
            "could not create the issue"
          )
        }
        // The server assigns the number, key and position, so the optimistic
        // row is a placeholder until the refetch replaces it.
      },
      onUpdate: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.PATCH("/api/tasks/{id}", {
              params: { path: { id: mutation.key } },
              body: {
                ...pick(mutation.changes, [
                  "title",
                  "description",
                  "status",
                  "priority",
                  "parentId",
                  "position",
                ]),
                ...(mutation.changes.labelIds === undefined
                  ? {}
                  : { labelIds: [...mutation.changes.labelIds] }),
              },
            }),
            "could not save the issue"
          )
        }
      },
      onDelete: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.DELETE("/api/tasks/{id}", {
              params: { path: { id: mutation.key } },
            }),
            "could not delete the issue"
          )
        }
      },
    })
  )

export type TasksCollection = ReturnType<typeof makeTasksCollection>

const tasksByProject = withKey<string, TasksCollection>()

export const tasksCollection = (projectId: string): TasksCollection => {
  const cached = tasksByProject.get(projectId)
  if (cached !== undefined) return cached
  const collection = makeTasksCollection(projectId)
  tasksByProject.set(projectId, collection)
  return collection
}

// --- labels ----------------------------------------------------------------

const makeLabelsCollection = (projectId: string) =>
  createCollection(
    queryCollectionOptions({
      queryKey: ["central", "labels", projectId],
      queryClient: workspaceQueryClient,
      getKey: (label) => label.id,
      queryFn: async () =>
        unwrap(
          await centralClient.GET("/api/labels", {
            params: { query: { projectId } },
          }),
          "could not load labels"
        ) as Array<Label>,
      onInsert: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.POST("/api/labels", {
              body: {
                projectId,
                name: mutation.modified.name,
                color: mutation.modified.color,
              },
            }),
            "could not create the label"
          )
        }
      },
      onUpdate: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.PATCH("/api/labels/{id}", {
              params: { path: { id: mutation.key } },
              body: pick(mutation.changes, ["name", "color"]),
            }),
            "could not save the label"
          )
        }
      },
      onDelete: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.DELETE("/api/labels/{id}", {
              params: { path: { id: mutation.key } },
            }),
            "could not delete the label"
          )
        }
      },
    })
  )

export type LabelsCollection = ReturnType<typeof makeLabelsCollection>

const labelsByProject = withKey<string, LabelsCollection>()

export const labelsCollection = (projectId: string): LabelsCollection => {
  const cached = labelsByProject.get(projectId)
  if (cached !== undefined) return cached
  const collection = makeLabelsCollection(projectId)
  labelsByProject.set(projectId, collection)
  return collection
}

// --- docs ------------------------------------------------------------------

/**
 * The collection holds summaries, not bodies: a project's docs can be long,
 * and the list only ever shows a title. One doc's body is fetched on demand
 * (see `useDoc`) and written back through this collection so the list's title
 * and timestamp stay in step.
 */
const makeDocsCollection = (projectId: string) =>
  createCollection(
    queryCollectionOptions({
      queryKey: ["central", "docs", projectId],
      queryClient: workspaceQueryClient,
      getKey: (doc) => doc.id,
      queryFn: async () =>
        unwrap(
          await centralClient.GET("/api/docs", {
            params: { query: { projectId } },
          }),
          "could not load docs"
        ) as Array<DocSummary>,
      onInsert: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.POST("/api/docs", {
              body: { projectId, title: mutation.modified.title },
            }),
            "could not create the doc"
          )
        }
      },
      onUpdate: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.PATCH("/api/docs/{id}", {
              params: { path: { id: mutation.key } },
              body: { title: mutation.changes.title },
            }),
            "could not rename the doc"
          )
        }
      },
      onDelete: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.DELETE("/api/docs/{id}", {
              params: { path: { id: mutation.key } },
            }),
            "could not delete the doc"
          )
        }
      },
    })
  )

export type DocsCollection = ReturnType<typeof makeDocsCollection>

const docsByProject = withKey<string, DocsCollection>()

export const docsCollection = (projectId: string): DocsCollection => {
  const cached = docsByProject.get(projectId)
  if (cached !== undefined) return cached
  const collection = makeDocsCollection(projectId)
  docsByProject.set(projectId, collection)
  return collection
}

/** One doc's body. Not a collection — it is read when a doc is opened. */
export const fetchDoc = async (id: string): Promise<Doc> =>
  unwrap(
    await centralClient.GET("/api/docs/{id}", { params: { path: { id } } }),
    "could not load the doc"
  )

export const saveDocContent = async (
  id: string,
  content: string
): Promise<Doc> =>
  unwrap(
    await centralClient.PATCH("/api/docs/{id}", {
      params: { path: { id } },
      body: { content },
    }),
    "could not save the doc"
  )

// --- comments --------------------------------------------------------------

const makeCommentsCollection = (
  subjectType: CommentSubject,
  subjectId: string,
  cacheKey: string
) =>
  createCollection(
    queryCollectionOptions({
      queryKey: ["central", "comments", cacheKey],
      queryClient: workspaceQueryClient,
      getKey: (comment) => comment.id,
      queryFn: async () =>
        unwrap(
          await centralClient.GET("/api/comments", {
            params: { query: { subjectType, subjectId } },
          }),
          "could not load comments"
        ) as Array<WorkspaceComment>,
      onInsert: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.POST("/api/comments", {
              body: {
                subjectType,
                subjectId,
                body: mutation.modified.body,
                parentId: mutation.modified.parentId,
              },
            }),
            "could not post the comment"
          )
        }
      },
      onUpdate: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.PATCH("/api/comments/{id}", {
              params: { path: { id: mutation.key } },
              body: { body: mutation.modified.body },
            }),
            "could not save the comment"
          )
        }
      },
      onDelete: async ({ transaction }) => {
        for (const mutation of transaction.mutations) {
          unwrap(
            await centralClient.DELETE("/api/comments/{id}", {
              params: { path: { id: mutation.key } },
            }),
            "could not delete the comment"
          )
        }
      },
    })
  )

export type CommentsCollection = ReturnType<typeof makeCommentsCollection>

const commentsBySubject = withKey<string, CommentsCollection>()

export const commentsCollection = (
  subjectType: CommentSubject,
  subjectId: string
): CommentsCollection => {
  const cacheKey = `${subjectType}:${subjectId}`
  const cached = commentsBySubject.get(cacheKey)
  if (cached !== undefined) return cached
  const collection = makeCommentsCollection(subjectType, subjectId, cacheKey)
  commentsBySubject.set(cacheKey, collection)
  return collection
}

/**
 * Drop every collection and its cache. Switching organization changes what
 * each of these ids means, so the safe move is to start over rather than try
 * to reconcile two tenants' rows.
 */
export const resetWorkspaceCollections = (): void => {
  projects = null
  tasksByProject.clear()
  labelsByProject.clear()
  docsByProject.clear()
  commentsBySubject.clear()
  workspaceQueryClient.clear()
}
