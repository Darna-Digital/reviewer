/**
 * AppShell — the single IDE orchestrator. It reads the navigation/selection
 * state from the type-safe TanStack route (mode, commit sha, range, pull, open
 * file) instead of the old `App.tsx`'s ~30 `useState`s, pulls data through
 * TanStack Query, derives the diff/tree via the composable `diff` functions, and
 * runs mutations through the composable `git-actions` / `comments` adapters.
 */
import {
  IconArrowDown,
  IconArrowUp,
  IconCloudDownload,
  IconColumns2,
  IconFile,
  IconFolders,
  IconGitBranch,
  IconGitCommit,
  IconGitCompare,
  IconGitFork,
  IconGitPullRequest,
  IconHistory,
  IconLayoutBottombarExpand,
  IconPlayerPlay,
  IconRefresh,
  IconRepeat,
  IconSettings,
  IconTerminal2,
} from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import {
  useNavigate,
  useParams,
  useRouterState,
  useSearch,
} from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { CommandMenu, type Command } from "@/components/command-menu"
import { CommitPanel } from "@/components/commit-panel"
import { DiffWorkerPoolProvider } from "@/components/diff-worker-pool"
import { RepoList } from "@/components/repo-list"
import {
  ReviewAssignBar,
  type AssignTarget,
} from "@/components/review-assign-bar"
import {
  DiffPane,
  type DraftLocation,
} from "@/interactions/diff/components/diff-pane"
import { CodeEditor } from "@/components/editor/code-editor"
import { CodeView } from "@/components/editor/code-view"
import { ConflictBanner } from "@/components/git/conflict-banner"
import { ConflictView } from "@/components/git/conflict-view"
import { PullRequestList } from "@/components/git/pull-request-list"
import { BottomPanel } from "@/components/layout/bottom-panel"
import type { Crumb } from "@/components/layout/breadcrumbs"
import { ModeRail } from "@/components/layout/mode-rail"
import { ResizeHandle } from "@/components/layout/resize-handle"
import { TopBar } from "@/components/layout/top-bar"
import { FileSidebar } from "@/components/tree/file-sidebar"
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter"
import {
  buildChatAssignmentSettings,
  buildReviewAssignmentPrompt,
  buildReviewAssignmentTitle,
} from "@/interactions/chats/functions/chat-assignment.functions"
import { useCommentsActions } from "@/interactions/comments/adapters/comments.hook.adapter"
import { useDiffFunctions } from "@/interactions/diff/adapters/diff.hook.adapter"
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter"
import { fetchClient } from "@/lib/api/client"
import {
  ALL_REFS,
  diffTargetKey,
  emptyLogQuery,
  fileHistoryQuery,
  logRefLabel,
  type AppMode,
  type DiffTarget,
  type LogQuery,
} from "@/lib/api/types"
import type { ReviewComment } from "@byconvo/core/comments"
import { pathName } from "@/lib/display-path"
import { errorReason } from "@/lib/errors"
import {
  useBranches,
  useChatModels,
  useChats,
  useComments,
  useCommitDetail,
  useDiffText,
  useFiles,
  useMergeState,
  usePagedLog,
  usePullComments,
  usePulls,
  useRemoteBranches,
  useRepo,
  useWorkspace,
} from "@/lib/queries"
import { openBottomTab, setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"

type Search = {
  base?: string
  head?: string
  file?: string
  edit?: boolean
  path?: string
}

// Target key under which worktree/browse comments are stored, so a comment left
// while browsing a file shows up again in commit mode.
const WORKTREE_KEY = diffTargetKey({ kind: "worktree" })

export function AppShell() {
  const navigate = useNavigate()
  const prefs = useUiPrefs()
  const diffFns = useDiffFunctions()
  const git = useGitActions()
  const comments = useCommentsActions()
  const chatActions = useChatsActions()
  const queryClient = useQueryClient()

  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })

  const mode: AppMode = pathname.startsWith("/review")
    ? "review"
    : pathname.startsWith("/browse")
      ? "browse"
      : "commit"

  // --- queries ---------------------------------------------------------------
  const workspace = useWorkspace()
  const repo = useRepo()
  const chatModels = useChatModels()
  const chats = useChats()
  const files = useFiles()
  const branches = useBranches()
  const remoteBranches = useRemoteBranches()
  const localComments = useComments()
  // Files carrying a local worktree comment (left here or while browsing). Commit
  // mode surfaces these in the tree even when the file has no git changes.
  const commentedPaths = useMemo(
    () => [
      ...new Set(
        (localComments.data ?? [])
          .filter((c) => c.target === WORKTREE_KEY)
          .map((c) => c.filePath)
      ),
    ],
    [localComments.data]
  )
  // The floating "assign to agent" bar's dismiss state. The comment set it acts
  // on (visibleComments — local + GitHub) is derived lower down, so the handler
  // lives there; the state stays here with the other UI state.
  const [assignBarDismissed, setAssignBarDismissed] = useState(false)
  const reviewCountRef = useRef(0)

  const hasGitHub = repo.data?.github != null
  const pulls = usePulls(hasGitHub)

  // Global keyboard shortcuts: Cmd/Ctrl+B toggles the bottom panel; Cmd/Ctrl+1/2/3
  // jump between the commit / review / browse modes (review only when on GitHub).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() === "b") {
        e.preventDefault()
        setUiPrefs({ bottomVisible: !prefs.bottomVisible })
        return
      }
      if (e.key === "1") {
        e.preventDefault()
        void navigate({ to: "/commit" })
      } else if (e.key === "2") {
        if (!hasGitHub) return
        e.preventDefault()
        void navigate({ to: "/review" })
      } else if (e.key === "3") {
        e.preventDefault()
        void navigate({ to: "/browse" })
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [prefs.bottomVisible, hasGitHub, navigate])
  // The in-progress merge/rebase, if any — drives the conflict banner + resolver.
  const mergeState = useMergeState()
  const conflictedPaths = useMemo(
    () => (mergeState.data?.conflicted ?? []).map((c) => c.path),
    [mergeState.data]
  )
  const [logFilters, setLogFilters] = useState<LogQuery>(emptyLogQuery)
  // The branch whose history the bottom panel shows; falls back to HEAD.
  const [logRef, setLogRef] = useState<string | null>(null)
  const log = usePagedLog(
    logRef ?? repo.data?.currentBranch ?? null,
    logFilters
  )

  const [pickerOpen, setPickerOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [draft, setDraft] = useState<DraftLocation | null>(null)

  // Live panel sizes for smooth dragging; seeded from (and committed back to)
  // the persisted prefs so they survive reloads. See `ResizeHandle`.
  const [sidebarWidth, setSidebarWidth] = useState(prefs.sidebarWidth)
  const [bottomHeight, setBottomHeight] = useState(prefs.bottomHeight)
  const [reviewPullsHeight, setReviewPullsHeight] = useState(
    prefs.reviewPullsHeight
  )

  const isFolder =
    workspace.data?.current != null && workspace.data.isGitRepo === false

  // Open the picker automatically only once the workspace has loaded with no
  // repository selected (not during the initial undefined loading state).
  useEffect(() => {
    if (workspace.isSuccess && workspace.data.current === null)
      setPickerOpen(true)
  }, [workspace.isSuccess, workspace.data])

  // --- selection / diff target ----------------------------------------------
  const selectedPull = useMemo(() => {
    if (params.pull === undefined) return null
    const n = Number(params.pull)
    return (
      pulls.data?.find((p) => p.number === n) ?? {
        number: n,
        title: `#${n}`,
        author: "",
        baseRef: "",
        headRef: "",
        headSha: "",
        url: "",
        updatedAt: "",
      }
    )
  }, [params.pull, pulls.data])

  const browse = useMemo(() => {
    if (params.sha !== undefined) {
      return {
        kind: "commit" as const,
        sha: params.sha,
        shortSha: params.sha.slice(0, 7),
      }
    }
    if (search.base !== undefined && search.head !== undefined) {
      return { kind: "range" as const, base: search.base, head: search.head }
    }
    return null
  }, [params.sha, search.base, search.head])

  const target: DiffTarget | null = diffFns.deriveTarget({
    mode,
    selectedPull,
    browse,
  })
  const targetKey = target === null ? "none" : diffTargetKey(target)

  const diff = useDiffText(target)
  const parsedFiles = useMemo(
    () => diffFns.parseFiles(typeof diff.data === "string" ? diff.data : null),
    [diff.data, diffFns]
  )
  const pullComments = usePullComments(
    target?.kind === "pull" ? target.pull.number : null
  )

  // Opening a commit out of a file's history shows just that file's side of it,
  // like the log's filter reads. Commits from before a rename don't carry the
  // path, so those fall back to the whole commit.
  const diffFiles = useMemo(() => {
    if (logFilters.path === null || target?.kind !== "commit")
      return parsedFiles
    const forPath = parsedFiles.filter((f) => f.name === logFilters.path)
    return forPath.length > 0 ? forPath : parsedFiles
  }, [parsedFiles, logFilters.path, target?.kind])

  // Reset the comment draft when the diff target or the open file changes.
  useEffect(() => setDraft(null), [targetKey, search.file])

  // --- derived tree / comments (memoised: these run over the whole repo) -----
  const gitStatus = useMemo(
    () => files.data?.gitStatus ?? [],
    [files.data?.gitStatus]
  )
  const allPaths = useMemo(() => files.data?.paths ?? [], [files.data?.paths])
  const treePaths = useMemo(
    () =>
      diffFns.treePaths({
        mode,
        allPaths,
        gitStatus,
        parsedFiles,
        commentedPaths,
      }),
    [diffFns, mode, allPaths, gitStatus, parsedFiles, commentedPaths]
  )
  const treeGitStatus = useMemo(
    () => diffFns.treeGitStatus({ mode, allPaths, gitStatus, parsedFiles }),
    [diffFns, mode, allPaths, gitStatus, parsedFiles]
  )
  const changedFiles = useMemo(
    () => diffFns.changedFiles(gitStatus),
    [diffFns, gitStatus]
  )
  const visibleComments = useMemo(
    () =>
      diffFns.visibleComments({
        targetKind: target?.kind ?? null,
        targetKey,
        localComments: localComments.data ?? [],
        pullComments: pullComments.data ?? [],
      }),
    [diffFns, target?.kind, targetKey, localComments.data, pullComments.data]
  )

  // --- review → agent: hand the comments in view (local + GitHub) to an agent.
  useEffect(() => {
    // Re-show the bar whenever a new comment appears (count grows past last seen).
    if (visibleComments.length > reviewCountRef.current)
      setAssignBarDismissed(false)
    reviewCountRef.current = visibleComments.length
  }, [visibleComments.length])

  const assignReview = async (dest: AssignTarget) => {
    if (visibleComments.length === 0) return
    const count = visibleComments.length
    const plural = count === 1 ? "" : "s"
    const prompt = buildReviewAssignmentPrompt(visibleComments)
    try {
      // New chat: start a titled one seeded with the comments. Existing session:
      // send the comments as a message into that chat.
      let chatId: string | null
      if (dest.kind === "new") {
        const started = await chatActions.startWithTitle(
          buildChatAssignmentSettings(dest.agent, chatModels.data),
          repo.data?.currentBranch ?? "",
          buildReviewAssignmentTitle(count),
          prompt
        )
        chatId = started?.id ?? null
      } else {
        const sent = await chatActions.send(dest.chatId, prompt)
        chatId = sent !== null ? dest.chatId : null
      }
      if (chatId === null) return
      // Handing the comments off resolves them: their text now lives in the chat,
      // so clear the local ones (remove() ignores GitHub comments) instead of
      // leaving them lingering in the diff.
      await Promise.all(
        visibleComments.map((comment) => comments.remove(comment))
      )
      toast.success(`Assigned ${count} comment${plural}`)
      void navigate({ to: "/chats/$chatId", params: { chatId } })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not assign comments"
      )
    }
  }

  // --- navigation helpers ----------------------------------------------------
  const setSearch = (patch: Partial<Search>) =>
    navigate({ to: ".", search: (prev: Search) => ({ ...prev, ...patch }) })
  const openFile = (path: string, edit: boolean) =>
    setSearch({ file: path, edit: edit || undefined })
  const closeFile = () => setSearch({ file: undefined, edit: undefined })

  // Show one file's past: the log filters down to it (following renames) and
  // the dock swings open on History.
  const showFileHistory = (path: string) => {
    setLogFilters(fileHistoryQuery(path))
    openBottomTab("history")
  }

  // --- conflict resolution ---------------------------------------------------
  const openConflict = (path: string) =>
    setSearch({ path, file: undefined, edit: undefined })
  const resolveConflictSide = async (path: string, side: "ours" | "theirs") => {
    await git.resolveConflict(path, side)
    if (search.path === path) setSearch({ path: undefined })
  }
  const resolveConflictContent = async (path: string, merged: string) => {
    await git.resolveConflictWithContent(path, merged)
    if (search.path === path) setSearch({ path: undefined })
  }

  const onFileSelect = (path: string | null) => {
    if (path === null) return
    if (mode === "browse") {
      openFile(path, false)
      return
    }
    // Commit mode: a file with no diff hunks isn't in the diff pane — either it
    // was newly added/untracked (git diff omits new files) or it only carries
    // local comments. Open it in the file viewer so its contents and comments
    // are still reachable; files that are in the diff open in the diff pane.
    if (mode === "commit" && !parsedFiles.some((f) => f.name === path)) {
      setSearch({ file: path, edit: undefined, path })
      return
    }
    setSearch({ path, file: undefined, edit: undefined })
  }

  const editing =
    search.file !== undefined && search.edit === true ? search.file : null
  const viewing =
    search.file !== undefined && search.edit !== true ? search.file : null

  // Local comments anchored to the file currently open in the viewer (worktree
  // target — see CodeView). Threaded into the viewer so browse/commit comments
  // appear inline on the source.
  const fileComments = useMemo(
    () =>
      viewing === null
        ? []
        : (localComments.data ?? []).filter(
            (c) => c.target === WORKTREE_KEY && c.filePath === viewing
          ),
    [localComments.data, viewing]
  )

  // The commit behind a history crumb. Same query key as the details panel, so
  // opening a commit from the log reads its subject straight from the cache.
  const browsedCommit = useCommitDetail(
    browse?.kind === "commit" ? browse.sha : null
  )

  const buildCrumbs = (): ReadonlyArray<Crumb> => {
    if (isFolder) {
      return [
        {
          id: "folder",
          label: `${workspace.data?.childRepos.length ?? 0} repositories`,
          icon: IconFolders,
        },
      ]
    }
    const openPath = editing ?? viewing
    const list: Crumb[] = []
    if (mode === "commit") {
      list.push({
        id: "commit-mode",
        label: "Local changes",
        icon: IconGitCommit,
        onClick: () => void navigate({ to: "/commit" }),
      })
    } else if (mode === "review") {
      list.push({
        id: "review-mode",
        label: "Pull requests",
        icon: IconGitPullRequest,
        onClick: () => void navigate({ to: "/review" }),
      })
      if (selectedPull !== null) {
        list.push({
          id: "pull",
          label: selectedPull.title,
          hint: `#${selectedPull.number}`,
        })
      }
    } else if (browse !== null) {
      // A commit or a range came from the log, so the trail starts at History
      // — that's what tells this apart from plain file browsing.
      list.push({
        id: "history",
        label: "History",
        icon: IconHistory,
        onClick: () => openBottomTab("history"),
      })
      const historyRef = logRef ?? repo.data?.currentBranch ?? null
      if (browse.kind === "commit") {
        if (historyRef !== null) {
          list.push({
            id: "ref",
            label: logRefLabel(historyRef),
            icon: historyRef === ALL_REFS ? IconGitFork : IconGitBranch,
          })
        }
        // The filtered file names what the diff below shows — unless a file is
        // open in the viewer, which ends the trail with a path of its own.
        if (logFilters.path !== null && openPath === null) {
          list.push({
            id: "history-path",
            label: pathName(logFilters.path),
            icon: IconFile,
            mono: true,
          })
        }
        list.push({
          id: "commit",
          label: browsedCommit.data?.subject ?? "Commit",
          hint: browse.shortSha,
          onClick: () => closeFile(),
        })
      } else {
        list.push({
          id: "range",
          label: `${browse.base} → ${browse.head}`,
          icon: IconGitCompare,
        })
      }
    } else {
      list.push({
        id: "browse-mode",
        label: "Project",
        icon: IconFolders,
        onClick: () => void navigate({ to: "/browse" }),
      })
    }
    if (openPath !== null)
      list.push({ id: "file", label: openPath, mono: true })
    return list
  }

  // --- handlers --------------------------------------------------------------
  const deletePath = async (path: string, isDirectory: boolean) => {
    if (
      !window.confirm(
        `Delete ${isDirectory ? "folder" : "file"} "${path}"? This cannot be undone.`
      )
    )
      return
    await fetchClient.DELETE("/api/file", { params: { query: { path } } })
    if (search.file === path) closeFile()
    git.refresh()
  }
  const renamePath = async (from: string, to: string) => {
    const { error } = await fetchClient.POST("/api/file/rename", {
      body: { from, to },
    })
    if (error) throw new Error("rename failed")
    git.refresh()
  }

  const submitComment = async (location: DraftLocation, body: string) => {
    await comments.submit({ mode, selectedPull, targetKey }, location, body)
    setDraft(null)
  }
  // Comments left on a file in the viewer (browse, or commit mode) always store
  // against the worktree, regardless of the active mode/diff target.
  const submitFileComment = async (location: DraftLocation, body: string) => {
    await comments.submit(
      { mode: "commit", selectedPull: null, targetKey: WORKTREE_KEY },
      location,
      body
    )
    setDraft(null)
  }
  const deleteComment = async (comment: ReviewComment) => {
    await comments.remove(comment)
  }
  const editComment = async (comment: ReviewComment, body: string) => {
    await comments.update(comment, body)
  }
  const replyComment = async (comment: ReviewComment, body: string) => {
    await comments.reply(selectedPull, comment, body)
    void pullComments.refetch()
  }

  // --- command palette -------------------------------------------------------
  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      {
        id: "go-commit",
        label: "Go to Local Changes",
        group: "Navigation",
        icon: IconGitCommit,
        keywords: "commit working tree changes",
        run: () => void navigate({ to: "/commit" }),
      },
    ]
    if (hasGitHub) {
      list.push({
        id: "go-review",
        label: "Go to Pull Requests",
        group: "Navigation",
        icon: IconGitPullRequest,
        keywords: "review pr github",
        run: () => void navigate({ to: "/review" }),
      })
    }
    list.push(
      {
        id: "go-browse",
        label: "Browse the Project",
        group: "Navigation",
        icon: IconFolders,
        keywords: "files history commits explore",
        run: () => void navigate({ to: "/browse" }),
      },
      {
        id: "git-refresh",
        label: "Refresh",
        group: "Git",
        icon: IconRefresh,
        keywords: "reload sync",
        run: () => git.refresh(),
      },
      {
        id: "git-fetch",
        label: "Fetch",
        group: "Git",
        icon: IconCloudDownload,
        keywords: "remote",
        run: () => void git.fetch(),
      },
      {
        id: "git-pull",
        label: "Pull",
        group: "Git",
        icon: IconArrowDown,
        keywords: "remote update",
        run: () => void git.pull(),
      },
      {
        id: "git-push",
        label: "Push",
        group: "Git",
        icon: IconArrowUp,
        keywords: "remote upload",
        run: () => void git.push(),
      },
      {
        id: "git-branch",
        label: "Create Branch…",
        group: "Git",
        icon: IconGitBranch,
        keywords: "new checkout",
        run: () => {
          const name = window.prompt("New branch name:")
          if (name && name.trim())
            void git.createBranch(name.trim(), repo.data?.currentBranch ?? null)
        },
      },
      {
        id: "go-settings",
        label: "Open Settings",
        group: "Navigation",
        icon: IconSettings,
        keywords: "theme dark light system appearance preferences",
        run: () => void navigate({ to: "/settings" }),
      },
      {
        id: "view-diff-style",
        label: "Toggle Diff Style",
        group: "View",
        icon: IconColumns2,
        keywords: "split unified side by side inline",
        hint: prefs.diffStyle,
        run: () =>
          setUiPrefs({
            diffStyle: prefs.diffStyle === "split" ? "unified" : "split",
          }),
      },
      {
        id: "view-bottom-panel",
        label: prefs.bottomVisible ? "Hide Bottom Panel" : "Show Bottom Panel",
        group: "View",
        icon: IconLayoutBottombarExpand,
        keywords: "branches history services threads toggle",
        run: () => setUiPrefs({ bottomVisible: !prefs.bottomVisible }),
      },
      {
        id: "view-services",
        label: "Open Services",
        group: "View",
        icon: IconPlayerPlay,
        keywords: "local dev commands run configurations",
        run: () => openBottomTab("services"),
      },
      {
        id: "view-threads",
        label: "Open Terminal Threads",
        group: "View",
        icon: IconTerminal2,
        keywords: "terminal shell agent cli",
        run: () => openBottomTab("threads"),
      },
      {
        id: "repo-switch",
        label: "Switch Repository…",
        group: "Repository",
        icon: IconRepeat,
        keywords: "open change project picker",
        run: () => setPickerOpen(true),
      }
    )
    return list
  }, [
    navigate,
    git,
    hasGitHub,
    prefs.diffStyle,
    prefs.bottomVisible,
    repo.data?.currentBranch,
  ])

  // --- center pane -----------------------------------------------------------
  const renderCenter = () => {
    if (isFolder) {
      return (
        <RepoList
          folder={workspace.data!.current!}
          repos={workspace.data!.childRepos}
          onOpen={(path) => void choose(path)}
        />
      )
    }
    if (editing !== null) {
      return (
        <CodeEditor
          path={editing}
          theme={prefs.resolvedTheme}
          onClose={closeFile}
          onSaved={git.refresh}
        />
      )
    }
    if (viewing !== null) {
      return (
        <CodeView
          path={viewing}
          theme={prefs.resolvedTheme}
          onEdit={(p) => openFile(p, true)}
          onClose={closeFile}
          onShowHistory={showFileHistory}
          comments={fileComments}
          draft={draft}
          onDraftOpen={setDraft}
          onDraftCancel={() => setDraft(null)}
          onCommentSubmit={submitFileComment}
          onCommentDelete={deleteComment}
          onCommentEdit={editComment}
        />
      )
    }
    if (
      mode === "commit" &&
      search.path != null &&
      conflictedPaths.includes(search.path)
    ) {
      return (
        <ConflictView
          path={search.path}
          theme={prefs.resolvedTheme}
          onUseSide={(side) => void resolveConflictSide(search.path!, side)}
          onResolve={(merged) =>
            void resolveConflictContent(search.path!, merged)
          }
          onEdit={(p) => openFile(p, true)}
          onClose={() => setSearch({ path: undefined })}
        />
      )
    }
    if (target === null) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
          <div className="font-medium">Nothing open</div>
          <div className="text-muted-foreground">
            {mode === "review"
              ? "Pick a pull request from the sidebar to review it."
              : "Pick a file from the tree, or a commit from the log."}
          </div>
        </div>
      )
    }
    return (
      <DiffPane
        files={diffFiles}
        theme={prefs.resolvedTheme}
        diffStyle={prefs.diffStyle}
        connectors={prefs.connectors}
        loading={diff.isPending}
        error={
          diff.error ? errorReason(diff.error, "Could not load diff") : null
        }
        target={target}
        comments={visibleComments}
        draft={draft}
        selectedFile={search.path ?? null}
        onDraftOpen={setDraft}
        onDraftCancel={() => setDraft(null)}
        onEditFile={(p) => openFile(p, true)}
        onShowFileHistory={showFileHistory}
        onDiscardFile={
          mode === "commit" ? (p) => void git.discard([p]) : undefined
        }
        onDiscardHunk={
          mode === "commit"
            ? (p, hunkIndex) => void git.discardHunk(p, hunkIndex)
            : undefined
        }
        onCommentSubmit={submitComment}
        onCommentDelete={deleteComment}
        onCommentEdit={editComment}
        onCommentReply={replyComment}
      />
    )
  }

  const choose = async (path: string) => {
    const { data, error } = await fetchClient.POST("/api/workspace", {
      body: { path },
    })
    if (error) {
      toast.error(
        (error as { message?: string; reason?: string }).message ??
          (error as { reason?: string }).reason ??
          "could not open repository"
      )
      return
    }
    if (data !== undefined) {
      queryClient.setQueryData(["get", "/api/workspace"], data)
    }
    await queryClient.invalidateQueries()
    void navigate({ to: "/commit", search: {} })
  }

  return (
    // One Shiki worker pool shared by every diff/file surface below (diff
    // pane, file viewer, editor, conflict view) — see DiffWorkerPoolProvider.
    <DiffWorkerPoolProvider>
      <div className="flex h-svh w-full overflow-hidden text-foreground">
        <CommandMenu
          open={commandOpen}
          onOpenChange={setCommandOpen}
          commands={commands}
          files={allPaths}
          onOpenFile={(path) => openFile(path, false)}
        />
        {visibleComments.length > 0 && !assignBarDismissed && (
          <ReviewAssignBar
            count={visibleComments.length}
            chats={chats.data ?? []}
            onAssign={assignReview}
            onDismiss={() => setAssignBarDismissed(true)}
          />
        )}
        <ModeRail mode={mode} hasGitHub={hasGitHub} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            repo={repo.data ?? null}
            workspace={workspace.data}
            branches={branches.data ?? []}
            remoteBranches={remoteBranches.data ?? []}
            crumbs={buildCrumbs()}
            diffStyle={prefs.diffStyle}
            showDiffStyleToggle={
              editing === null && viewing === null && target !== null
            }
            busy={false}
            pickerOpen={pickerOpen}
            onPickerOpenChange={setPickerOpen}
            onDiffStyleChange={(diffStyle) => setUiPrefs({ diffStyle })}
            onCheckout={(b) => {
              void git.checkout(b)
              void navigate({ to: "/commit" })
            }}
            onCheckoutAndUpdate={(b) => {
              void git.checkoutAndUpdate(b)
              void navigate({ to: "/commit" })
            }}
            onCreateBranch={(name, sp) => void git.createBranch(name, sp)}
            onCompare={(base, head) =>
              void navigate({ to: "/browse/range", search: { base, head } })
            }
            onMerge={(b) => void git.merge(b)}
            onRebase={(o) => void git.rebase(o)}
            onRenameBranch={(from, to) => void git.renameBranch(from, to)}
            onDeleteBranch={(name) => void git.deleteBranch(name)}
            onFetch={() => void git.fetch()}
            onPush={() => void git.push()}
            onPull={() => void git.pull()}
          />

          {/* Everything below the title bar sits in a panel whose left border +
            rounded top-left form the rail divider, so it curves in right above
            the file list while the title-bar strip stays clean. */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-lg border-t border-l">
            <div className="flex min-h-0 flex-1">
              {/* Review mode stacks the pull request picker above the selected
                  PR's file tree; the other modes are just the tree. */}
              <div
                className="flex shrink-0 flex-col overflow-hidden border-r"
                style={{ width: sidebarWidth }}
              >
                {mode === "review" && (
                  <>
                    <PullRequestList
                      pulls={pulls.data ?? []}
                      error={
                        pulls.error
                          ? errorReason(
                              pulls.error,
                              "Could not load pull requests"
                            )
                          : null
                      }
                      loading={pulls.isPending}
                      selectedNumber={selectedPull?.number ?? null}
                      onSelect={(p) =>
                        void navigate({
                          to: "/review/$pull",
                          params: { pull: String(p.number) },
                        })
                      }
                      className={
                        selectedPull === null ? "flex-1" : "shrink-0 border-b"
                      }
                      style={
                        selectedPull === null
                          ? undefined
                          : { height: reviewPullsHeight }
                      }
                    />
                    {selectedPull !== null && (
                      <ResizeHandle
                        orientation="row"
                        value={reviewPullsHeight}
                        min={80}
                        max={() => Math.max(120, window.innerHeight - 320)}
                        onResize={setReviewPullsHeight}
                        onResizeEnd={(h) =>
                          setUiPrefs({ reviewPullsHeight: h })
                        }
                        label="Resize pull request list"
                      />
                    )}
                  </>
                )}
                {(mode !== "review" || selectedPull !== null) && (
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <FileSidebar
                      key={mode}
                      mode={mode}
                      paths={treePaths}
                      gitStatus={treeGitStatus}
                      loading={
                        mode === "review" ? diff.isPending : files.isPending
                      }
                      selectedFile={
                        mode === "browse"
                          ? (viewing ?? editing)
                          : (search.path ?? null)
                      }
                      onFileSelect={onFileSelect}
                      onDeletePath={mode === "review" ? undefined : deletePath}
                      onRenamePath={mode === "review" ? undefined : renamePath}
                      onShowHistory={showFileHistory}
                      footer={
                        mode === "commit" && changedFiles.length > 0 ? (
                          <CommitPanel
                            changes={changedFiles}
                            busy={false}
                            onCommit={(m, p, push) =>
                              git.commitChanges(m, p, push)
                            }
                            onGenerate={(p, agent) =>
                              git.generateCommitMessage(p, agent)
                            }
                          />
                        ) : undefined
                      }
                    />
                  </div>
                )}
              </div>
              <ResizeHandle
                orientation="col"
                value={sidebarWidth}
                min={180}
                max={() => Math.max(240, window.innerWidth - 400)}
                onResize={setSidebarWidth}
                onResizeEnd={(w) => setUiPrefs({ sidebarWidth: w })}
                label="Resize sidebar"
              />
              <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
                {mode === "commit" &&
                  mergeState.data != null &&
                  mergeState.data.operation !== "none" && (
                    <ConflictBanner
                      state={mergeState.data}
                      selectedPath={search.path ?? null}
                      onSelectFile={openConflict}
                      onAbort={() => void git.abortMerge()}
                      onContinue={() => void git.continueMerge()}
                    />
                  )}
                <div className="min-h-0 flex-1 overflow-hidden">
                  {renderCenter()}
                </div>
              </main>
            </div>
            {prefs.bottomVisible && (
              <ResizeHandle
                orientation="row"
                value={bottomHeight}
                min={120}
                max={() => Math.max(160, window.innerHeight - 200)}
                direction={-1}
                onResize={setBottomHeight}
                onResizeEnd={(h) => setUiPrefs({ bottomHeight: h })}
                label="Resize bottom panel"
              />
            )}
            <div
              className={cn(
                "shrink-0 overflow-hidden border-t",
                !prefs.bottomVisible && "hidden"
              )}
              style={{ height: bottomHeight }}
              hidden={!prefs.bottomVisible}
            >
              <BottomPanel
                tab={prefs.bottomTab}
                active={prefs.bottomVisible}
                onTabChange={(tab) => setUiPrefs({ bottomTab: tab })}
                branches={branches.data ?? []}
                remoteBranches={remoteBranches.data ?? []}
                currentBranch={repo.data?.currentBranch ?? null}
                commits={log.commits}
                commitsLoading={log.loading}
                commitsHaveMore={log.hasMore}
                logRef={logRef ?? repo.data?.currentBranch ?? null}
                logFilters={logFilters}
                selectedCommitSha={
                  browse?.kind === "commit" ? browse.sha : null
                }
                selectedCommitFile={viewing ?? editing}
                onLoadMoreCommits={log.loadMore}
                onLogRefChange={setLogRef}
                onLogFiltersChange={setLogFilters}
                onBranchCheckout={(b) => {
                  void git.checkout(b)
                  void navigate({ to: "/commit" })
                }}
                onSelectCommit={(c) =>
                  void navigate({
                    to: "/browse/commit/$sha",
                    params: { sha: c.sha },
                    search: (prev: Search) => ({
                      ...prev,
                      path: logFilters.path ?? undefined,
                      file: undefined,
                      edit: undefined,
                    }),
                  })
                }
                onSelectCommitFile={(p) => openFile(p, false)}
              />
            </div>
          </div>
        </div>
      </div>
    </DiffWorkerPoolProvider>
  )
}
