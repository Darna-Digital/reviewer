/**
 * Shared TanStack Query hooks over the typed API client. Route loaders use
 * `api.queryOptions(...)`; components use these hooks. Centralising them keeps
 * query keys consistent so mutations/invalidation hit the right caches.
 */
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api, fetchClient } from "@/lib/api/client";
import { isCloudRunActive } from "@reviewer/core/cloud";
import { isMultiRepo } from "@reviewer/core/workspace";
import type { DiffTarget, LogQuery } from "@/lib/api/types";

/**
 * How long an answer is worth reusing, and what makes it worth asking again.
 *
 * Two different things used to be answered by the same setting. A tab switch
 * unmounts one shell and mounts another, and with nothing held fresh every hook
 * in the new one re-asked the server: thirty-odd requests for one click, six at
 * a time down a keep-alive connection, for data the window had been given a
 * moment earlier. Coming back to the window is the opposite case — files change
 * under the app while you are in an editor, and the answer really is stale.
 *
 * So navigation reads from the cache and focus is what refetches. Writes are
 * unaffected either way: every mutation already invalidates what it touched.
 */
const GIT_DATA = {
  staleTime: 30_000,
  // However fresh git's answer is, it was true of a tree that anything else on
  // the machine can have changed since — so returning to the window asks again.
  refetchOnWindowFocus: "always",
} as const;

/** Written only through this app, and invalidated by whatever writes it. */
const OWN_DATA = { staleTime: 30_000 } as const;

/**
 * History: git data, but paged. Refetching one of these on focus refetches
 * every page scrolled so far, so it is left to go stale on its own rather than
 * being forced — what a new commit changes is the first page, and that is what
 * committing already invalidates.
 */
const HISTORY = { staleTime: 30_000 } as const;

/** A catalog, not a reading: it is the same answer for the whole session. */
const CATALOG = { staleTime: Infinity } as const;

/** Answered over the network by someone else, and slow enough to show it. */
const REMOTE = { staleTime: 60_000, refetchOnWindowFocus: false } as const;

export const useWorkspace = () =>
  api.useQuery("get", "/api/workspace", {}, GIT_DATA);
export const useRepo = () => api.useQuery("get", "/api/repo", {}, GIT_DATA);
export const useFiles = () => api.useQuery("get", "/api/files", {}, GIT_DATA);
export const useStatus = () => api.useQuery("get", "/api/status", {}, GIT_DATA);
export const useBranches = () =>
  api.useQuery("get", "/api/branches", {}, GIT_DATA);
export const useRemoteBranches = () =>
  api.useQuery("get", "/api/remote-branches", {}, GIT_DATA);
/** Where each branch's work is aimed — reviewer's own record, not git's. */
export const useBranchTargets = () =>
  api.useQuery("get", "/api/branch-targets", {}, OWN_DATA);
export const useComments = () =>
  api.useQuery("get", "/api/comments", {}, OWN_DATA);

// --- Project-wide git (every root the open project holds) ------------------
// The `/api/repo`-backed hooks above answer for the selected repository; these
// answer for the whole project, each entry carrying the root it came from.

/** Whether the open project holds more than one root — which reads to use. */
export const useMultiRepo = (): boolean => {
  const workspace = useWorkspace();
  return isMultiRepo({ repos: workspace.data?.repos ?? [] });
};

/** Every root's files, named from the project root so the tree nests them. */
export const useProjectFiles = (enabled: boolean) =>
  api.useQuery("get", "/api/project/files", {}, { ...GIT_DATA, enabled });

/** Every root's uncommitted diff as one diff, with project-relative paths. */
export const useProjectDiff = (enabled: boolean) =>
  api.useQuery("get", "/api/project/diff", {}, { ...GIT_DATA, enabled });

/** Uncommitted work in every root — the commit view's per-repository groups. */
export const useProjectChanges = () =>
  api.useQuery("get", "/api/project/changes", {}, GIT_DATA);

/** Every root's branches — the branch popup's per-repository sections. */
export const useProjectBranches = () =>
  api.useQuery("get", "/api/project/branches", {}, GIT_DATA);

/**
 * Every root's history merged, one page at a time — the project-wide twin of
 * `usePagedLog`, with the same append-only paging so scrolling walks back
 * through the merged history instead of stopping at the first page.
 *
 * The filters mean the same thing in every root, so they go out unchanged and
 * the server applies them per root before merging: an author or a message
 * searched for here is searched for across the whole project.
 */
export const usePagedProjectLog = (enabled: boolean, filters: LogQuery) => {
  const query = useInfiniteQuery({
    queryKey: ["project-log-pages", filters],
    ...HISTORY,
    enabled,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await fetchClient.GET("/api/project/log", {
        params: { query: logSearchParams(null, filters, pageParam) },
      });
      if (error !== undefined) throw error;
      return data?.commits ?? [];
    },
    // A short page is the end of the merged history; a full one may have more.
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < LOG_PAGE_SIZE
        ? undefined
        : pages.reduce((count, page) => count + page.length, 0),
  });

  const entries = useMemo(
    () => (query.data?.pages ?? []).flat(),
    [query.data?.pages]
  );

  return {
    entries,
    loading: query.isPending,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
  };
};

/** The in-progress merge/rebase operation and its remaining conflicts. */
export const useMergeState = () =>
  api.useQuery("get", "/api/merge-state", {}, GIT_DATA);

/**
 * The commit message the agent CLI is drafting for the open project, if any.
 * The draft is the server's, not this page's — it is asked for on every mount
 * because the run it reports may have been started by a page that is gone —
 * and is watched while it runs, which is the only stretch it changes over.
 */
export const useCommitDraft = () =>
  api.useQuery(
    "get",
    "/api/git-message/draft",
    {},
    {
      staleTime: 0,
      refetchInterval: (query) =>
        query.state.data?.status === "running" ? 1_000 : false,
      refetchOnWindowFocus: "always",
    }
  );

// --- Threads / Chats (workspace features) ---------------------------------

export const useThreads = () =>
  api.useQuery("get", "/api/threads", {}, OWN_DATA);

/**
 * The sessions list — every project's conversations, newest first, a page at a
 * time.
 *
 * The filters go to the server with the page rather than being applied to what
 * came back. Narrowing here would only ever search the pages already scrolled
 * to, so a session that had not been reached yet would read as one that does
 * not exist — the list would answer "nothing matches" about a list it has not
 * finished reading. See `ChatListQuery`.
 */
export interface ChatListFilters {
  /** Free text over title, last message and project name. */
  readonly search: string;
  /** A project's absolute path; null is every project. */
  readonly project: string | null;
  /** ISO timestamp; null is any time. */
  readonly since: string | null;
}

export const NO_CHAT_FILTERS: ChatListFilters = {
  search: "",
  project: null,
  since: null,
};

const CHAT_PAGE_SIZE = 30;

/**
 * How many sessions the surfaces that only want the newest ones ask for: the
 * strip's unread dot, the tab titles, and the inbox popover. All of them are
 * questions about the top of the list, so they read its first page rather than
 * all of it.
 */
const RECENT_CHATS = 30;

/**
 * A turn that settles only reaches the list when the list is asked again. The
 * chat's own socket asks for the session in front of the reader, but nothing
 * asks for the ones working in the background — so a list with work in it is
 * watched, the way the cloud runs are, and left alone the moment it settles.
 * Without this a row that finished elsewhere keeps its orb spinning.
 */
const RUNNING_TURN_POLL_MS = 4_000;

const hasRunningTurn = (
  items: ReadonlyArray<{ readonly turnState: string | null }> | undefined
): boolean => (items ?? []).some((chat) => chat.turnState === "running");

export const recentChatsOptions = () =>
  api.queryOptions(
    "get",
    "/api/chats",
    { params: { query: { limit: String(RECENT_CHATS) } } },
    {
      ...OWN_DATA,
      refetchInterval: (query) =>
        hasRunningTurn(query.state.data?.items) ? RUNNING_TURN_POLL_MS : false,
    }
  );

/** The newest sessions — the top of the list, not all of it. */
export const useRecentChats = () => useQuery(recentChatsOptions());

/** Every project holding a session, for the list's filter menu. */
export const useChatProjects = () =>
  api.useQuery("get", "/api/chats/projects", {}, OWN_DATA);

/** How many hits the search popover shows — one screenful, not a second list. */
const SEARCH_HITS = 12;

/**
 * The search popover's own read: the whole list is no longer in the client to
 * be filtered, and a search that only looked at the pages already scrolled to
 * would answer "nothing matches" about sessions it had simply not fetched.
 */
export const useChatSearch = (search: string, enabled: boolean) => {
  const text = search.trim();
  return api.useQuery(
    "get",
    "/api/chats",
    {
      params: {
        query: {
          limit: String(SEARCH_HITS),
          ...(text.length === 0 ? {} : { q: text }),
        },
      },
    },
    { ...OWN_DATA, enabled, placeholderData: (previous) => previous }
  );
};

const chatListQuery = (filters: ChatListFilters, cursor: string | null) => ({
  limit: String(CHAT_PAGE_SIZE),
  ...(cursor === null ? {} : { cursor }),
  ...(filters.search.trim().length === 0 ? {} : { q: filters.search.trim() }),
  ...(filters.project === null ? {} : { project: filters.project }),
  ...(filters.since === null ? {} : { since: filters.since }),
});

/**
 * The list itself, paged as the reader scrolls.
 *
 * Keyed under the same prefix as every other read of `/api/chats`, so the one
 * `invalidateQueries(["get", "/api/chats"])` that a new session, a settled turn
 * or a deletion already fires still refreshes it.
 */
export const useChatPages = (filters: ChatListFilters, enabled = true) => {
  const query = useInfiniteQuery({
    queryKey: ["get", "/api/chats", "pages", filters],
    ...OWN_DATA,
    enabled,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await fetchClient.GET("/api/chats", {
        params: { query: chatListQuery(filters, pageParam) },
      });
      if (error !== undefined) throw error;
      return data;
    },
    // Only the server can say the list has ended: with a `WHERE` clause behind
    // it, a page can come back short and still have more after it.
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    refetchInterval: (list) =>
      (list.state.data?.pages ?? []).some((page) => hasRunningTurn(page?.items))
        ? RUNNING_TURN_POLL_MS
        : false,
  });

  const sessions = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page?.items ?? []),
    [query.data?.pages]
  );

  return {
    sessions,
    loading: query.isPending,
    hasMore: query.hasNextPage,
    loadingMore: query.isFetchingNextPage,
    loadMore: query.fetchNextPage,
  };
};

/** The static provider/model catalog behind the composer's model picker. */
export const useChatModels = () =>
  api.useQuery("get", "/api/chats/models", {}, CATALOG);

const CHAT_STALE_MS = 15_000;

/**
 * One chat's full record, under the key everything that holds a conversation
 * shares: the hover preview's REST read, the route's prefetch on intent and the
 * live view, which seeds itself from this cache and writes its latest snapshot
 * back — so reopening a session you have already seen paints from it instead of
 * waiting on the socket.
 */
export const chatQueryOptions = (id: string) =>
  api.queryOptions(
    "get",
    "/api/chats/{id}",
    { params: { path: { id } } },
    { staleTime: CHAT_STALE_MS }
  );

/** The sidebar's hover preview — fetched only once a card is primed. */
export const useChatPreview = (id: string, enabled: boolean) =>
  useQuery({ ...chatQueryOptions(id), enabled });

export const useThread = (id: string | null) =>
  api.useQuery(
    "get",
    "/api/threads/{id}",
    { params: { path: { id: id ?? "" } } },
    { ...OWN_DATA, enabled: id !== null }
  );

/** Saved Local Dev commands across the project's repos, with runtime status. */
export const useDevCommands = () =>
  api.useQuery("get", "/api/local-dev/commands", {}, OWN_DATA);

/** The base/ours/theirs index stages of a conflicted file. */
export const useConflictBlobs = (path: string | null) =>
  api.useQuery(
    "get",
    "/api/conflict",
    { params: { query: { path: path ?? "" } } },
    { enabled: path !== null }
  );

/**
 * Every open pull request, with CI and mergeability on each.
 *
 * Unlike the other remote reads this one does refetch on focus: half of what it
 * carries is about a build that is running somewhere else. A window left open
 * beside a CI tab would otherwise keep saying a check is still going long after
 * it went red, and a status light that stops moving stops being read.
 */
export const usePulls = (enabled: boolean) =>
  api.useQuery(
    "get",
    "/api/github/pulls",
    {},
    { ...REMOTE, refetchOnWindowFocus: true, enabled }
  );

/**
 * A commit is immutable once it exists, so the one thing that could make this
 * answer wrong is the sha changing — and that is a different key.
 */
export const useCommitDetail = (sha: string | null) =>
  api.useQuery(
    "get",
    "/api/commit/{sha}",
    { params: { path: { sha: sha ?? "" } } },
    { ...CATALOG, enabled: sha !== null }
  );

export const usePullComments = (pullNumber: number | null) =>
  api.useQuery(
    "get",
    "/api/github/pulls/{number}/comments",
    { params: { path: { number: String(pullNumber ?? "") } } },
    { ...REMOTE, enabled: pullNumber !== null }
  );

/** How many commits one page of history holds. */
export const LOG_PAGE_SIZE = 150;

const logSearchParams = (
  ref: string | null,
  filters: LogQuery,
  skip: number
): Record<string, string> => {
  const query: Record<string, string> = {
    ref: ref ?? "HEAD",
    limit: String(LOG_PAGE_SIZE),
  };
  if (skip > 0) query["skip"] = String(skip);
  if (filters.author !== null) query["author"] = filters.author;
  if (filters.grep !== null) query["grep"] = filters.grep;
  if (filters.regex) query["regex"] = "1";
  if (filters.caseSensitive) query["case"] = "1";
  if (filters.after !== null) query["after"] = filters.after;
  if (filters.before !== null) query["before"] = filters.before;
  if (filters.path !== null) query["path"] = filters.path;
  if (filters.follow) query["follow"] = "1";
  return query;
};

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
    ...HISTORY,
    enabled: ref !== null,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await fetchClient.GET("/api/log", {
        params: { query: logSearchParams(ref, filters, pageParam) },
      });
      if (error !== undefined) throw error;
      return data ?? [];
    },
    // A short page is the end of the history; a full one may have more behind it.
    getNextPageParam: (lastPage, pages) =>
      lastPage.length < LOG_PAGE_SIZE
        ? undefined
        : pages.reduce((count, page) => count + page.length, 0),
  });

  const commits = useMemo(
    () => (query.data?.pages ?? []).flat(),
    [query.data?.pages]
  );

  return {
    commits,
    loading: query.isPending,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
  };
};

/** The right diff for the current target (worktree / commit / range / PR). */
export const useDiffText = (target: DiffTarget | null) => {
  const worktree = api.useQuery(
    "get",
    "/api/diff",
    {},
    { ...GIT_DATA, enabled: target?.kind === "worktree" }
  );
  // A commit's diff, like the commit itself, cannot change under the key it is
  // held at; only the worktree's can.
  const commit = api.useQuery(
    "get",
    "/api/diff",
    {
      params: {
        query: { commit: target?.kind === "commit" ? target.sha : "" },
      },
    },
    { ...CATALOG, enabled: target?.kind === "commit" }
  );
  // The whole branch, against what it is aimed at. Git data rather than a
  // catalog: the merge base is fixed, but the working tree on the other side
  // of it changes under the app the way the plain worktree diff does.
  const branch = api.useQuery(
    "get",
    "/api/diff",
    {
      params: {
        query: { target: target?.kind === "branch" ? target.target : "" },
      },
    },
    { ...GIT_DATA, enabled: target?.kind === "branch" }
  );
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
    { ...GIT_DATA, enabled: target?.kind === "range" }
  );
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
    { ...REMOTE, enabled: target?.kind === "pull" }
  );

  switch (target?.kind) {
    case "worktree":
      return worktree;
    case "branch":
      return branch;
    case "commit":
      return commit;
    case "range":
      return range;
    case "pull":
      return pull;
    default:
      return worktree;
  }
};

/**
 * How hard a read of one file tries before the viewer gives up on it.
 *
 * A missing or unreadable path — a staged-then-deleted "AD" ghost with no
 * worktree content — has no answer coming, and retrying it just hangs the
 * viewer on "Loading", so this stays short. But it is no longer none: writing
 * a file refreshes every query in the app at once, and on a large project the
 * read of the file that was just made queues behind a dozen `git` calls. That
 * one is worth asking again — twice, a fifth of a second apart, is under half
 * a second before the error shows and is the difference between a new file
 * opening and a pane that says it could not be opened.
 */
const FILE_READ = { retry: 2, retryDelay: 200 } as const;

export const useFileBytes = (path: string | null) =>
  api.useQuery(
    "get",
    "/api/file/raw",
    { params: { query: { path: path ?? "" } } },
    { ...GIT_DATA, ...FILE_READ, enabled: path !== null }
  );

export const useFile = (path: string | null) =>
  api.useQuery(
    "get",
    "/api/file",
    { params: { query: { path: path ?? "" } } },
    { ...GIT_DATA, ...FILE_READ, enabled: path !== null }
  );

// --- reviewer cloud ---------------------------------------------------------

/**
 * Whether the app is connected to reviewer cloud, and as whom. Refetched on
 * focus: the approval half of connecting happens in a browser tab, and coming
 * back to the window is the moment the answer is most likely to have changed.
 */
export const cloudStatusOptions = () =>
  api.queryOptions(
    "get",
    "/api/cloud/status",
    {},
    { staleTime: 30_000, refetchOnWindowFocus: "always" }
  );

export const useCloudStatus = () => useQuery(cloudStatusOptions());

/** The repositories linked in the cloud — asked for only once connected. */
export const useCloudRepos = (enabled: boolean) =>
  api.useQuery("get", "/api/cloud/repos", {}, { ...REMOTE, enabled });

/**
 * Every cloud run, newest first. Watched while any of them is still working,
 * since the sidebar's dots are read off their status.
 */
export const useCloudRuns = (enabled: boolean) =>
  api.useQuery(
    "get",
    "/api/cloud/runs",
    {},
    {
      staleTime: 5_000,
      enabled,
      refetchInterval: (query) =>
        query.state.data?.some((run) => isCloudRunActive(run.status)) === true
          ? 5_000
          : false,
    }
  );

/**
 * One cloud run's snapshot, under the key the live view seeds itself from and
 * writes its latest fold back to — so reopening a run paints from the cache
 * instead of waiting on the stream.
 */
export const cloudRunQueryOptions = (id: string) =>
  api.queryOptions(
    "get",
    "/api/cloud/runs/{id}",
    { params: { path: { id } } },
    { staleTime: 15_000 }
  );

export const useCloudRun = (id: string | null) =>
  useQuery({ ...cloudRunQueryOptions(id ?? ""), enabled: id !== null });
