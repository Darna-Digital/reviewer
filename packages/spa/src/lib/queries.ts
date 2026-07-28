/**
 * Shared TanStack Query hooks over the typed API client. Route loaders use
 * `api.queryOptions(...)`; components use these hooks. Centralising them keeps
 * query keys consistent so mutations/invalidation hit the right caches.
 */
import { useInfiniteQuery } from "@tanstack/react-query"
import { useMemo } from "react"
import { api, fetchClient } from "@/lib/api/client"
import type { DiffTarget, LogQuery } from "@/lib/api/types"

export const useWorkspace = () => api.useQuery("get", "/api/workspace")
export const useRepo = () => api.useQuery("get", "/api/repo")
export const useFiles = () => api.useQuery("get", "/api/files")
export const useStatus = () => api.useQuery("get", "/api/status")
export const useBranches = () => api.useQuery("get", "/api/branches")
export const useRemoteBranches = () =>
  api.useQuery("get", "/api/remote-branches")
export const useComments = () => api.useQuery("get", "/api/comments")

/** Comments anchored to a DOM element by the injected picker. */
export const useVisualComments = () =>
  api.useQuery("get", "/api/visual-comments")

/** The in-progress merge/rebase operation and its remaining conflicts. */
export const useMergeState = () => api.useQuery("get", "/api/merge-state")

// --- Threads / Chats / Docs / Tasks (workspace features) ------------------

export const useThreads = () => api.useQuery("get", "/api/threads")

/** Agent chats (structured conversations, distinct from terminal threads). */
export const useChats = () => api.useQuery("get", "/api/chats")

/** The static provider/model catalog behind the composer's model picker. */
export const useChatModels = () => api.useQuery("get", "/api/chats/models")

/**
 * One chat's full record. The live view streams over a WebSocket instead; this
 * is the cheap REST read behind the sidebar's hover preview, so it only fires
 * once a preview card actually opens.
 */
export const useChatPreview = (id: string, enabled: boolean) =>
  api.useQuery(
    "get",
    "/api/chats/{id}",
    { params: { path: { id } } },
    { enabled, staleTime: 15_000 }
  )

export const useThread = (id: string | null) =>
  api.useQuery(
    "get",
    "/api/threads/{id}",
    { params: { path: { id: id ?? "" } } },
    { enabled: id !== null }
  )

export const useDocs = () => api.useQuery("get", "/api/docs")

export const useDoc = (id: string | null) =>
  api.useQuery(
    "get",
    "/api/docs/{id}",
    { params: { path: { id: id ?? "" } } },
    { enabled: id !== null }
  )

export const useTasks = () => api.useQuery("get", "/api/tasks/board")

/** Saved Local Dev commands for the selected repo, with their runtime status. */
export const useDevCommands = () =>
  api.useQuery("get", "/api/local-dev/commands")

/** The base/ours/theirs index stages of a conflicted file. */
export const useConflictBlobs = (path: string | null) =>
  api.useQuery(
    "get",
    "/api/conflict",
    { params: { query: { path: path ?? "" } } },
    { enabled: path !== null }
  )

export const usePulls = (enabled: boolean) =>
  api.useQuery("get", "/api/github/pulls", {}, { enabled })

export const useCommitDetail = (sha: string | null) =>
  api.useQuery(
    "get",
    "/api/commit/{sha}",
    { params: { path: { sha: sha ?? "" } } },
    {
      enabled: sha !== null,
    }
  )

export const usePullComments = (pullNumber: number | null) =>
  api.useQuery(
    "get",
    "/api/github/pulls/{number}/comments",
    { params: { path: { number: String(pullNumber ?? "") } } },
    { enabled: pullNumber !== null }
  )

/** How many commits one page of history holds. */
export const LOG_PAGE_SIZE = 150

const logSearchParams = (
  ref: string | null,
  filters: LogQuery,
  skip: number
): Record<string, string> => {
  const query: Record<string, string> = {
    ref: ref ?? "HEAD",
    limit: String(LOG_PAGE_SIZE),
  }
  if (skip > 0) query["skip"] = String(skip)
  if (filters.author !== null) query["author"] = filters.author
  if (filters.grep !== null) query["grep"] = filters.grep
  if (filters.regex) query["regex"] = "1"
  if (filters.caseSensitive) query["case"] = "1"
  if (filters.after !== null) query["after"] = filters.after
  if (filters.before !== null) query["before"] = filters.before
  if (filters.path !== null) query["path"] = filters.path
  if (filters.follow) query["follow"] = "1"
  return query
}

/**
 * The commit log, one page at a time. Each page fetches only the commits past
 * the ones already held (`skip`) and is appended, so scrolling back through a
 * long history neither refetches what is on screen nor rebuilds those rows.
 * React Query drops `fetchNextPage` calls made while a page is in flight, which
 * is what keeps a single flick of the wheel from firing several of them.
 */
export const usePagedLog = (ref: string | null, filters: LogQuery) => {
  const query = useInfiniteQuery({
    queryKey: ["log-pages", ref, filters],
    enabled: ref !== null,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await fetchClient.GET("/api/log", {
        params: { query: logSearchParams(ref, filters, pageParam) },
      })
      if (error !== undefined) throw error
      return data ?? []
    },
    // A short page is the end of the history; a full one may have more behind it.
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < LOG_PAGE_SIZE
        ? undefined
        : pages.reduce((count, page) => count + page.length, 0),
  })

  const commits = useMemo(
    () => (query.data?.pages ?? []).flat(),
    [query.data?.pages]
  )

  return {
    commits,
    loading: query.isPending,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
  }
}

/** The right diff for the current target (worktree / commit / range / PR). */
export const useDiffText = (target: DiffTarget | null) => {
  const worktree = api.useQuery(
    "get",
    "/api/diff",
    {},
    {
      enabled: target?.kind === "worktree",
    }
  )
  const commit = api.useQuery(
    "get",
    "/api/diff",
    {
      params: {
        query: { commit: target?.kind === "commit" ? target.sha : "" },
      },
    },
    { enabled: target?.kind === "commit" }
  )
  const range = api.useQuery(
    "get",
    "/api/diff",
    {
      params: {
        query:
          target?.kind === "range"
            ? { base: target.base, head: target.head }
            : { base: "", head: "" },
      },
    },
    { enabled: target?.kind === "range" }
  )
  const pull = api.useQuery(
    "get",
    "/api/github/pulls/{number}/diff",
    {
      params: {
        path: {
          number: target?.kind === "pull" ? String(target.pull.number) : "",
        },
      },
    },
    { enabled: target?.kind === "pull" }
  )

  switch (target?.kind) {
    case "worktree":
      return worktree
    case "commit":
      return commit
    case "range":
      return range
    case "pull":
      return pull
    default:
      return worktree
  }
}

export const useFile = (path: string | null) =>
  api.useQuery(
    "get",
    "/api/file",
    { params: { query: { path: path ?? "" } } },
    // A file read either succeeds or it doesn't — retrying a missing/unreadable
    // path (e.g. a staged-then-deleted "AD" ghost that has no worktree content)
    // just hangs the viewer on "Loading", so fail fast and surface the error.
    { enabled: path !== null, retry: false }
  )
