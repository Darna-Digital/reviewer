/**
 * The code surface — the file tree beside the diff, the file viewer, the
 * conflict resolver, the tab strip and the trail.
 *
 * It is a page, not a shell. It used to be `AppShell`: a layout route that
 * carried the window frame, the mode rail, the toolbar and the bottom dock as
 * well as all of this, with a second shell (`WorkspaceShell`) carrying its own
 * copies of the same chrome for the sessions and workspace pages. They were
 * siblings in the route tree, so every trip between a diff and a conversation
 * threw one of them away whole. The chrome now lives once, in `AppLayout`, and
 * this renders into it.
 *
 * It reads its navigation and selection state from the type-safe route (mode,
 * commit sha, range, pull, open file) rather than holding it, pulls data
 * through TanStack Query, derives the diff/tree via the composable `diff`
 * functions, and runs mutations through the composable `git-actions` /
 * `comments` adapters.
 */
import {
  IconColumns2,
  IconFolders,
  IconGitBranch,
  IconGitCommit,
  IconGitCompare,
  IconGitFork,
  IconGitPullRequest,
  IconHistory,
  IconLayoutBottombarExpand,
  IconPlayerPlay,
  IconTerminal2,
} from "@tabler/icons-react";
import {
  useNavigate,
  useParams,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Command } from "@/interactions/search/interfaces/search.interfaces";
import { CommitPanel } from "@/components/commit-panel";
import {
  ReviewAssignBar,
  type AssignTarget,
} from "@/components/review-assign-bar";
import {
  DiffPane,
  type DraftLocation,
} from "@/interactions/diff/components/diff-pane";
import { CodeView } from "@/components/editor/code-view";
import { ImageView, isImagePath } from "@/components/editor/image-view";
import { ConflictBanner } from "@/components/git/conflict-banner";
import { ConflictView } from "@/components/git/conflict-view";
import { PullRequestList } from "@/components/git/pull-request-list";
import type { Crumb } from "@/components/layout/breadcrumbs";
import { EmptyPane } from "@/components/layout/empty-pane";
import { PathBar } from "@/components/layout/path-bar";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { SidebarResizeHandle } from "@/components/layout/sidebar-resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { FileSidebar } from "@/components/tree/file-sidebar";
import { assignToChat } from "@/interactions/chats/adapters/assign-to-chat.adapter";
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter";
import {
  buildReviewAssignmentPrompt,
  buildReviewAssignmentTitle,
} from "@/interactions/chats/functions/chat-assignment.functions";
import { useCommentsActions } from "@/interactions/comments/adapters/comments.hook.adapter";
import { useDiffFunctions } from "@/interactions/diff/adapters/diff.hook.adapter";
import { useRegisterCommands } from "@/interactions/search/adapters/search.store";
import { ProjectRepos } from "@/interactions/workspace/components/project-repos";
import { isMultiRepo } from "@byconvo/core/workspace";
import {
  useRepoCommands,
  useWorkspaceActions,
} from "@/interactions/workspace/adapters/workspace.hook.adapter";
import { TabStrip } from "@/interactions/tabs/components/tab-strip";
import {
  readTabs,
  scopeTabsTo,
  updateTabs,
  useTabs,
} from "@/interactions/tabs/adapters/tabs.store";
import {
  closeAll,
  closeOthers,
  closeTab,
  keepTab,
  moveTab,
  openTab,
  pruneTabs,
  syncActive,
  tabToRestore,
  togglePin,
} from "@/interactions/tabs/functions/tabs.functions";
import { useFileActions } from "@/interactions/file-actions/adapters/file-actions.hook.adapter";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import { fetchClient } from "@/lib/api/client";
import {
  ALL_REFS,
  diffTargetKey,
  fileHistoryQuery,
  logRefLabel,
  type AppMode,
  type DiffTarget,
} from "@/lib/api/types";
import type { ReviewComment } from "@byconvo/core/comments";
import { pathName } from "@/lib/display-path";
import { errorReason } from "@/lib/errors";
import {
  useChatModels,
  useRecentChats,
  useComments,
  useCommitDetail,
  useCommitDraft,
  useDiffText,
  useFiles,
  useMergeState,
  useProjectDiff,
  useProjectFiles,
  usePullComments,
  usePulls,
  useRepo,
  useWorkspace,
} from "@/lib/queries";
import {
  resetHistoryFilters,
  setHistoryQuery,
  useHistoryFilters,
} from "@/interactions/history/history-filters.store";
import { useCodeReveal } from "@/lib/code-reveal";
import { openBottomTab, setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

type Search = {
  base?: string;
  head?: string;
  file?: string;
  path?: string;
  line?: number;
};

// Target key under which worktree/browse comments are stored, so a comment left
// while browsing a file shows up again in commit mode.
const WORKTREE_KEY = diffTargetKey({ kind: "worktree" });

export function CodeWorkspace() {
  const navigate = useNavigate();
  const prefs = useUiPrefs();
  const diffFns = useDiffFunctions();
  const git = useGitActions();
  const comments = useCommentsActions();
  const chatActions = useChatsActions();

  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false });

  const mode: AppMode = pathname.startsWith("/modes/code/review")
    ? "review"
    : pathname.startsWith("/modes/code/browse")
      ? "browse"
      : "commit";

  // --- queries ---------------------------------------------------------------
  const workspace = useWorkspace();
  const workspaceActions = useWorkspaceActions();
  const repo = useRepo();
  const chatModels = useChatModels();
  const chats = useRecentChats();
  const files = useFiles();
  const localComments = useComments();
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
  );

  const hasGitHub = repo.data?.github != null;
  const pulls = usePulls(hasGitHub);

  // Watched from here rather than from the commit panel: the drafting agent CLI
  // keeps running while the user is in another mode, and this is what is still
  // mounted to notice it finish.
  const commitDraft = useCommitDraft();

  // The in-progress merge/rebase, if any — drives the conflict banner + resolver.
  const mergeState = useMergeState();
  const conflictedPaths = useMemo(
    () => (mergeState.data?.conflicted ?? []).map((c) => c.path),
    [mergeState.data]
  );
  // The history dock lives in the layout above this page and owns its own
  // paging; what is read here is the filter it is on, which the trail and the
  // per-file diff filter both reflect. See `history-filters.store`.
  const { ref: logRef, query: logFilters } = useHistoryFilters();
  const multiRepo = isMultiRepo({ repos: workspace.data?.repos ?? [] });

  // Callback-ref state, not a ref object: the file view renders into this node,
  // so it has to re-render once the node exists.
  const [fileActionsSlot, setFileActionsSlot] = useState<HTMLElement | null>(
    null
  );
  const [draft, setDraft] = useState<DraftLocation | null>(null);

  // Panel sizes live in the DOM, not in this component's state: a drag reports
  // a new size on every pointer frame, and re-rendering this shell — the tree,
  // the diff and every file section in it, the dock — for each of them was the
  // jankiest thing in the app. The drag now writes a CSS variable and only the
  // final size is committed back to the prefs. See `usePanelSize`.
  const sidebar = usePanelSize("sidebar-w", prefs.sidebarWidth, "width");
  const reviewPulls = usePanelSize(
    "review-pulls-h",
    prefs.reviewPullsHeight,
    "height"
  );

  // A project with no git root at all: there is nothing repo-scoped to show,
  // so the centre pane says so instead of rendering an empty tree.
  const noRepo =
    workspace.data?.project != null && workspace.data.current === null;

  // --- selection / diff target ----------------------------------------------
  const selectedPull = useMemo(() => {
    if (params.pull === undefined) return null;
    const n = Number(params.pull);
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
    );
  }, [params.pull, pulls.data]);

  const browse = useMemo(() => {
    if (params.sha !== undefined) {
      return {
        kind: "commit" as const,
        sha: params.sha,
        shortSha: params.sha.slice(0, 7),
      };
    }
    if (search.base !== undefined && search.head !== undefined) {
      return { kind: "range" as const, base: search.base, head: search.head };
    }
    return null;
  }, [params.sha, search.base, search.head]);

  const target: DiffTarget | null = diffFns.deriveTarget({
    mode,
    selectedPull,
    browse,
  });
  const targetKey = target === null ? "none" : diffTargetKey(target);

  const diff = useDiffText(target);
  // The uncommitted diff of every root at once, its paths named from the
  // project so they line up with the tree. Only the worktree target: a commit
  // or a range belongs to one root, and is read from that root as before.
  const projectDiff = useProjectDiff(multiRepo && target?.kind === "worktree");
  const diffText =
    multiRepo && target?.kind === "worktree"
      ? (projectDiff.data ?? null)
      : typeof diff.data === "string"
        ? diff.data
        : null;
  const parsedFiles = useMemo(
    () => diffFns.parseFiles(diffText),
    [diffText, diffFns]
  );
  const pullComments = usePullComments(
    target?.kind === "pull" ? target.pull.number : null
  );

  // Opening a commit out of a file's history shows just that file's side of it,
  // like the log's filter reads. Commits from before a rename don't carry the
  // path, so those fall back to the whole commit.
  const diffFiles = useMemo(() => {
    if (logFilters.path === null || target?.kind !== "commit")
      return parsedFiles;
    const forPath = parsedFiles.filter((f) => f.name === logFilters.path);
    return forPath.length > 0 ? forPath : parsedFiles;
  }, [parsedFiles, logFilters.path, target?.kind]);

  // Reset the comment draft when the diff target or the open file changes.
  useEffect(() => setDraft(null), [targetKey, search.file]);

  // --- derived tree / comments (memoised: these run over the whole repo) -----
  // Paths are named from the project root once it holds more than one
  // repository, so the tree nests the roots as folders without being told to
  // and a file opens without anything being switched first. A single-root
  // project reads the repository's own listing, where the two are the same.
  const projectFiles = useProjectFiles(multiRepo);
  const listing = multiRepo ? projectFiles.data : files.data;
  const gitStatus = useMemo(
    () => listing?.gitStatus ?? [],
    [listing?.gitStatus]
  );
  const allPaths = useMemo(() => listing?.paths ?? [], [listing?.paths]);
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
  );
  const treeGitStatus = useMemo(
    () => diffFns.treeGitStatus({ mode, allPaths, gitStatus, parsedFiles }),
    [diffFns, mode, allPaths, gitStatus, parsedFiles]
  );
  const changedFiles = useMemo(
    () => diffFns.changedFiles(gitStatus),
    [diffFns, gitStatus]
  );
  const visibleComments = useMemo(
    () =>
      diffFns.visibleComments({
        targetKind: target?.kind ?? null,
        targetKey,
        localComments: localComments.data ?? [],
        pullComments: pullComments.data ?? [],
        viewingFile: search.file ?? null,
      }),
    [
      diffFns,
      target?.kind,
      targetKey,
      localComments.data,
      pullComments.data,
      search.file,
    ]
  );

  // --- review → agent: hand the comments in view (local + GitHub) to an agent.
  const assignReview = async (dest: AssignTarget) => {
    if (visibleComments.length === 0) return;
    const count = visibleComments.length;
    const plural = count === 1 ? "" : "s";
    const prompt = buildReviewAssignmentPrompt(visibleComments);
    try {
      const chatId = await assignToChat(chatActions, {
        target: dest,
        catalog: chatModels.data,
        branch: repo.data?.currentBranch ?? "",
        title: buildReviewAssignmentTitle(count),
        prompt,
      });
      if (chatId === null) return;
      // Handing the comments off resolves them: their text now lives in the chat,
      // so clear the local ones (remove() ignores GitHub comments) instead of
      // leaving them lingering in the diff.
      await Promise.all(
        visibleComments.map((comment) => comments.remove(comment))
      );
      toast.success(`Assigned ${count} comment${plural}`);
      void navigate({ to: "/modes/agent-session/$chatId", params: { chatId } });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not assign comments"
      );
    }
  };

  // --- navigation helpers ----------------------------------------------------
  const setSearch = (patch: Partial<Search>) =>
    navigate({ to: ".", search: (prev: Search) => ({ ...prev, ...patch }) });
  const openFile = (path: string) => setSearch({ file: path });
  const closeFile = () => setSearch({ file: undefined });

  const fileActions = useFileActions(openFile);
  // A folder created here holds nothing for git to list, so the tree is told
  // about it separately until it does.
  const sidebarPaths = useMemo(
    () => fileActions.withPendingFolders(treePaths),
    [fileActions, treePaths]
  );

  // Which file is open for editing rather than reading. Held here because the
  // request comes from the file's tab, above the view that does the editing.
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const editFile = (path: string) => {
    openFile(path);
    setEditingFile(path);
  };

  // Go-to-definition and find-usages land here: open the file (it may already
  // be the one on screen) and ask the view to reveal the line. The counter lets
  // the same line be revealed twice in a row.
  const [reveal, setReveal] = useState<{ line: number; key: number } | null>(
    null
  );
  const revealLine = (lineNumber: number) =>
    setReveal((previous) => ({
      line: lineNumber,
      key: (previous?.key ?? 0) + 1,
    }));
  const openLocation = (path: string, lineNumber: number) => {
    openFile(path);
    revealLine(lineNumber);
  };
  /**
   * A comment picked out of the bar's list: a permanent tab, since picking a
   * comment is deliberate, and the line revealed outright so following the same
   * comment twice scrolls both times.
   *
   * It stays in the mode it was left in, unlike the analysis pane's jump — a
   * comment belongs to the changes on screen, so pulling the window out to the
   * browser would leave the review the comment came from.
   */
  const openComment = (id: string) => {
    const comment = visibleComments.find((c) => c.id === id);
    if (comment === undefined) return;
    updateTabs((state) => openTab(state, comment.filePath, "permanent"));
    setSearch({
      file: comment.filePath,
      path: comment.filePath,
      line: comment.lineNumber,
    });
    revealLine(comment.lineNumber);
  };

  // A `line` in the URL is how another surface points at code — the comments
  // page linking a comment back to the line it was left on.
  useEffect(() => {
    if (search.line === undefined || search.file === undefined) return;
    revealLine(search.line);
  }, [search.line, search.file]);

  /**
   * The same jump, asked for outright rather than through the URL. A surface
   * pointing at the line already in the params leaves them untouched, so the
   * effect above never re-runs; this one keys off the request counter instead
   * and fires as soon as the file it names is the one on screen.
   */
  const revealRequest = useCodeReveal();
  const revealed = useRef(0);
  useEffect(() => {
    if (revealRequest === null || revealRequest.key === revealed.current) {
      return;
    }
    // Navigation lands a moment after the request, so it waits for its file
    // rather than being spent against whatever was open at the time.
    if (search.file !== revealRequest.path) return;
    revealed.current = revealRequest.key;
    revealLine(revealRequest.line);
  }, [revealRequest, search.file]);

  // Show one file's past: the log filters down to it (following renames) and
  // the dock swings open on History.
  const showFileHistory = (path: string) => {
    setHistoryQuery(fileHistoryQuery(path));
    openBottomTab("history");
  };

  // --- conflict resolution ---------------------------------------------------
  const openConflict = (path: string) => setSearch({ path, file: undefined });
  const resolveConflictSide = async (path: string, side: "ours" | "theirs") => {
    await git.resolveConflict(path, side);
    if (search.path === path) setSearch({ path: undefined });
  };
  const resolveConflictContent = async (path: string, merged: string) => {
    await git.resolveConflictWithContent(path, merged);
    if (search.path === path) setSearch({ path: undefined });
  };

  const onFileSelect = (path: string | null) => {
    if (path === null) return;
    if (mode === "browse") {
      openFile(path);
      return;
    }
    // Commit mode: a file with no diff hunks isn't in the diff pane — either it
    // was newly added/untracked (git diff omits new files) or it only carries
    // local comments. Open it in the file viewer so its contents and comments
    // are still reachable; files that are in the diff open in the diff pane.
    if (mode === "commit" && !parsedFiles.some((f) => f.name === path)) {
      setSearch({ file: path, path });
      return;
    }
    setSearch({ path, file: undefined });
  };

  const viewing = search.file ?? null;
  const showFileTabs = mode !== "commit" || viewing !== null;

  // --- open-file tabs --------------------------------------------------------
  // The strip follows the open file rather than owning it: navigation arrives
  // from the tree, the command menu, go-to-definition and restored URLs alike.
  const tabs = useTabs();
  const repoRoot = repo.data?.root ?? null;
  useEffect(() => {
    scopeTabsTo(repoRoot);
  }, [repoRoot]);
  /**
   * Drop the view state that belongs to the root being left behind: the URL is
   * repo-relative (the open file, the commit, the pull request) and so is the
   * branch the history follows, and the root arriving has never heard of any
   * of it. Called before the switch so nothing refetches against the old ref.
   */
  const leaveRepo = useCallback(() => {
    resetHistoryFilters();
    // Browse, not commit: moving between a project's roots is navigation, and
    // it lands you in the arriving root's tree rather than in a review of
    // whatever happens to be uncommitted there.
    void navigate({ to: "/modes/code/browse", search: {} });
  }, [navigate]);
  // The safety net for a move this shell did not start — the command palette,
  // say. Only a move between roots of the same project resets: the first
  // resolve on load has nothing to leave, and opening a whole project is the
  // picker's move to land wherever it means to.
  const openProject = workspace.data?.project ?? null;
  const previous = useRef({ root: repoRoot, project: openProject });
  useEffect(() => {
    const was = previous.current;
    if (was.root === repoRoot) return;
    previous.current = { root: repoRoot, project: openProject };
    const movedWithinProject =
      was.root !== null && repoRoot !== null && was.project === openProject;
    if (movedWithinProject) leaveRepo();
  }, [repoRoot, openProject, leaveRepo]);
  // Browsing has nothing else to put in the centre pane, so the strip is the
  // view: an open tab with no file on screen is a hole. A strip outlives the
  // URL that opened its files — restored from storage, or left behind by
  // navigation that dropped the file — so it names what belongs there.
  const canRestore = mode === "browse" && target === null && !noRepo;
  // Re-syncs when the repository resolves as well as when the file changes:
  // pointing the store at a repository swaps in that repository's strip, which
  // would otherwise drop the file already on screen.
  useEffect(() => {
    if (viewing === null && canRestore) {
      const restored = tabToRestore(readTabs());
      // Replaces rather than pushes, so Back leaves the strip behind instead of
      // returning to a URL that reopens the same file.
      if (restored !== null) {
        void navigate({
          to: ".",
          search: (prev: Search) => ({ ...prev, file: restored }),
          replace: true,
        });
        return;
      }
    }
    updateTabs((state) => syncActive(state, viewing));
  }, [repoRoot, viewing, canRestore, navigate]);
  // A strip restored from a previous session can name files that have since
  // been deleted or renamed.
  useEffect(() => {
    if (allPaths.length === 0) return;
    const known = new Set(allPaths);
    updateTabs((state) => pruneTabs(state, (path) => known.has(path)));
  }, [allPaths]);

  // Only the open file has a buffer, so it is the only one that can be dirty.
  const [dirtyFile, setDirtyFile] = useState<string | null>(null);
  const dirtyPaths = useMemo(
    () => new Set(dirtyFile === null ? [] : [dirtyFile]),
    [dirtyFile]
  );
  const onDirtyChange = useCallback(
    (dirty: boolean) => {
      setDirtyFile(dirty ? (search.file ?? null) : null);
      // Editing a file is the clearest possible statement that you are staying
      // in it, so it stops being a preview.
      if (dirty && search.file !== undefined) {
        const path = search.file;
        updateTabs((state) => keepTab(state, path));
      }
    },
    [search.file]
  );

  const selectTab = (path: string) => setSearch({ file: path });
  const closeTabAt = (path: string) => {
    updateTabs((state) => {
      const next = closeTab(state, path);
      // Closing the tab on screen moves the file view to its neighbour, or
      // shuts it when the strip empties.
      if (state.active === path) {
        setSearch({ file: next.active ?? undefined });
      }
      return next;
    });
  };

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
  );

  // The commit behind a history crumb. Same query key as the details panel, so
  // opening a commit from the log reads its subject straight from the cache.
  const browsedCommit = useCommitDetail(
    browse?.kind === "commit" ? browse.sha : null
  );

  const buildCrumbs = (): ReadonlyArray<Crumb> => {
    if (noRepo) {
      return [
        {
          id: "project",
          label: pathName(workspace.data?.project ?? ""),
          icon: IconFolders,
        },
      ];
    }
    const openPath = viewing;
    const list: Crumb[] = [];
    if (mode === "commit") {
      list.push({
        id: "commit-mode",
        label: "Local changes",
        icon: IconGitCommit,
        onClick: () => void navigate({ to: "/modes/code/commit" }),
      });
    } else if (mode === "review") {
      list.push({
        id: "review-mode",
        label: "Pull requests",
        icon: IconGitPullRequest,
        onClick: () => void navigate({ to: "/modes/code/review" }),
      });
      if (selectedPull !== null) {
        list.push({
          id: "pull",
          label: selectedPull.title,
          hint: `#${selectedPull.number}`,
        });
      }
    } else if (browse !== null) {
      // A commit or a range came from the log, so the trail starts at History
      // — that's what tells this apart from plain file browsing.
      list.push({
        id: "history",
        label: "History",
        icon: IconHistory,
        onClick: () => openBottomTab("history"),
      });
      const historyRef = logRef ?? repo.data?.currentBranch ?? null;
      if (browse.kind === "commit") {
        if (historyRef !== null) {
          list.push({
            id: "ref",
            label: logRefLabel(historyRef),
            icon: historyRef === ALL_REFS ? IconGitFork : IconGitBranch,
          });
        }
        // The filtered file names what the diff below shows — unless a file is
        // open in the viewer, which ends the trail with a path of its own.
        if (logFilters.path !== null && openPath === null) {
          list.push({
            id: "history-path",
            label: pathName(logFilters.path),
            icon: (props: { className?: string }) => (
              <FileTypeIcon path={logFilters.path ?? ""} {...props} />
            ),
          });
        }
        list.push({
          id: "commit",
          label: browsedCommit.data?.subject ?? "Commit",
          hint: browse.shortSha,
          onClick: () => closeFile(),
        });
      } else {
        list.push({
          id: "range",
          label: `${browse.base} → ${browse.head}`,
          icon: IconGitCompare,
        });
      }
    } else {
      list.push({
        id: "browse-mode",
        label: "Project",
        onClick: () => void navigate({ to: "/modes/code/browse" }),
      });
    }
    // The open file itself is not a crumb: the strip names it, and its tab
    // carries the full path as a tooltip.
    return list;
  };

  // --- handlers --------------------------------------------------------------
  const deletePath = async (path: string, isDirectory: boolean) => {
    if (
      !window.confirm(
        `Delete ${isDirectory ? "folder" : "file"} "${path}"? This cannot be undone.`
      )
    )
      return;
    await fetchClient.DELETE("/api/file", { params: { query: { path } } });
    if (search.file === path) closeFile();
    git.refresh();
  };
  const renamePath = async (from: string, to: string) => {
    const { error } = await fetchClient.POST("/api/file/rename", {
      body: { from, to },
    });
    if (error) throw new Error("rename failed");
    git.refresh();
  };

  /**
   * Send a comment and close the composer behind it.
   *
   * The composer closes first, not last. The comment is already on the line by
   * the time this returns to the caller — it is written into the list before
   * the request goes out — so leaving the draft open until the server answers
   * would sit an empty second composer under a comment that is already there.
   *
   * A refused write is the case worth handling: the comment rolls back off the
   * line, and the composer reopens holding what was typed, so the words survive
   * a failure that had nothing to do with them.
   */
  const sendComment = async (
    ctx: Parameters<typeof comments.submit>[0],
    location: DraftLocation,
    body: string
  ) => {
    setDraft(null);
    try {
      await comments.submit(ctx, location, body);
    } catch (error) {
      setDraft({ ...location, body });
      toast.error(errorReason(error, "Could not save the comment"));
    }
  };

  const submitComment = (location: DraftLocation, body: string) =>
    sendComment({ mode, selectedPull, targetKey }, location, body);

  // Comments left on a file in the viewer (browse, or commit mode) always store
  // against the worktree, regardless of the active mode/diff target.
  const submitFileComment = (location: DraftLocation, body: string) =>
    sendComment(
      { mode: "commit", selectedPull: null, targetKey: WORKTREE_KEY },
      location,
      body
    );
  const deleteComment = async (comment: ReviewComment) => {
    await comments.remove(comment);
  };
  const editComment = async (comment: ReviewComment, body: string) => {
    await comments.update(comment, body);
  };
  const replyComment = async (comment: ReviewComment, body: string) => {
    await comments.reply(selectedPull, comment, body);
    void pullComments.refetch();
  };

  // --- command palette -------------------------------------------------------
  // Only what this shell owns; the code-wide commands live with the dialog, so
  // every page offers them. Registered for as long as the shell is mounted.
  const shellCommands = useMemo<ReadonlyArray<Command>>(
    () => [
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
        keywords: "history services sessions terminal toggle",
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
        label: "Open Terminal Sessions",
        group: "View",
        icon: IconTerminal2,
        keywords: "terminal shell session cli",
        run: () => openBottomTab("threads"),
      },
    ],
    [prefs.diffStyle, prefs.bottomVisible]
  );
  useRegisterCommands("code-shell", shellCommands);
  useRepoCommands(workspace.data, leaveRepo);

  /** Follow another of the open project's roots, staying where we are. */
  const chooseRepo = async (path: string) => {
    leaveRepo();
    await workspaceActions.openRepo(path);
  };

  // --- center pane -----------------------------------------------------------
  const renderCenter = () => {
    if (noRepo) {
      return (
        <ProjectRepos
          project={workspace.data!.project!}
          repos={workspace.data!.repos}
          onOpen={(path) => void chooseRepo(path)}
        />
      );
    }
    if (viewing !== null && isImagePath(viewing)) {
      return <ImageView path={viewing} theme={prefs.resolvedTheme} />;
    }
    if (viewing !== null) {
      return (
        <CodeView
          path={viewing}
          theme={prefs.resolvedTheme}
          onSaved={git.refresh}
          onDirtyChange={onDirtyChange}
          actionsSlot={fileActionsSlot}
          editing={editingFile === viewing}
          onEditingChange={(on) => setEditingFile(on ? viewing : null)}
          onOpenLocation={openLocation}
          reveal={reveal}
          comments={fileComments}
          draft={draft}
          onDraftOpen={setDraft}
          onDraftCancel={() => setDraft(null)}
          onCommentSubmit={submitFileComment}
          onCommentDelete={deleteComment}
          onCommentEdit={editComment}
        />
      );
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
          onEdit={editFile}
          onClose={() => setSearch({ path: undefined })}
        />
      );
    }
    if (target === null) {
      return (
        <EmptyPane
          hint={
            mode === "review"
              ? "Pick a pull request from the sidebar to review it"
              : "Pick a file from the tree, or a commit from the log"
          }
        />
      );
    }
    return (
      <DiffPane
        onOpenLocation={openLocation}
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
        onEditFile={editFile}
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
    );
  };

  const crumbs = buildCrumbs();

  return (
    <div className="flex min-h-0 flex-1">
      {/* Review mode stacks the pull request picker above the selected
                  PR's file tree; the other modes are just the tree. */}
      <div
        className={cn(
          "flex shrink-0 flex-col overflow-hidden border-r",
          !prefs.sidebarVisible && "hidden"
        )}
        style={sidebar.style}
      >
        {mode === "review" && (
          <>
            <PullRequestList
              pulls={pulls.data ?? []}
              error={
                pulls.error
                  ? errorReason(pulls.error, "Could not load pull requests")
                  : null
              }
              loading={pulls.isPending}
              selectedNumber={selectedPull?.number ?? null}
              onSelect={(p) =>
                void navigate({
                  to: "/modes/code/review/$pull",
                  params: { pull: String(p.number) },
                })
              }
              className={selectedPull === null ? "flex-1" : "shrink-0 border-b"}
              style={selectedPull === null ? undefined : reviewPulls.style}
            />
            {selectedPull !== null && (
              <ResizeHandle
                orientation="row"
                value={reviewPulls.current}
                min={80}
                max={() => Math.max(120, window.innerHeight - 320)}
                onResize={reviewPulls.onResize}
                onResizeEnd={(h) => setUiPrefs({ reviewPullsHeight: h })}
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
              paths={sidebarPaths}
              gitStatus={treeGitStatus}
              loading={mode === "review" ? diff.isPending : files.isPending}
              selectedFile={mode === "browse" ? viewing : (search.path ?? null)}
              onFileSelect={onFileSelect}
              onDeletePath={mode === "review" ? undefined : deletePath}
              onRenamePath={mode === "review" ? undefined : renamePath}
              onCreatePath={mode === "review" ? undefined : fileActions.create}
              onShowHistory={showFileHistory}
              footer={
                mode === "commit" && changedFiles.length > 0 ? (
                  <CommitPanel
                    changes={changedFiles}
                    busy={false}
                    project={workspace.data?.project ?? ""}
                    onCommit={(m, p, push) => git.commitChanges(m, p, push)}
                    onGenerate={(p, agent) => git.startCommitMessage(p, agent)}
                    draft={commitDraft.data}
                    onDraftSettled={(settled) => {
                      if (settled.status === "error" && settled.error !== null)
                        toast.error(settled.error);
                      void git.clearCommitDraft();
                    }}
                  />
                ) : undefined
              }
            />
          </div>
        )}
      </div>
      {prefs.sidebarVisible && (
        <SidebarResizeHandle
          width={sidebar.current}
          stored={prefs.sidebarWidth}
          max={() => Math.max(240, window.innerWidth - 400)}
          onResize={sidebar.onResize}
          onResizeEnd={(w) => setUiPrefs({ sidebarWidth: w })}
        />
      )}
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {showFileTabs && (
            <TabStrip
              tabs={tabs.tabs}
              active={tabs.active}
              dirty={dirtyPaths}
              onSelect={selectTab}
              onKeep={(path) => updateTabs((state) => keepTab(state, path))}
              onClose={closeTabAt}
              onTogglePin={(path) =>
                updateTabs((state) => togglePin(state, path))
              }
              onCloseOthers={(path) =>
                updateTabs((state) => {
                  const next = closeOthers(state, path);
                  setSearch({ file: next.active ?? undefined });
                  return next;
                })
              }
              onCloseAll={() =>
                updateTabs((state) => {
                  const next = closeAll(state);
                  setSearch({ file: next.active ?? undefined });
                  return next;
                })
              }
              onMove={(path, toIndex) =>
                updateTabs((state) => moveTab(state, path, toIndex))
              }
            />
          )}
          {/* The assign bar floats over the code itself, so it clears
                      the path bar and stops at the panes' edge rather than the
                      window's. */}
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {renderCenter()}
            {visibleComments.length > 0 && (
              <ReviewAssignBar
                comments={visibleComments.map((comment) => ({
                  id: comment.id,
                  file: comment.filePath,
                  line: comment.lineNumber,
                  body: comment.body,
                }))}
                chats={chats.data?.items ?? []}
                onAssign={assignReview}
                onOpenComment={openComment}
                className="absolute inset-x-3 bottom-8"
              />
            )}
          </div>
          {/* The trail closes the pane, and only once it says more than
                      which mode you are in. */}
          {(crumbs.length > 1 || viewing !== null) && (
            <PathBar
              crumbs={crumbs}
              path={viewing}
              paths={allPaths}
              onOpenFile={openFile}
              onEdit={
                viewing !== null &&
                !isImagePath(viewing) &&
                editingFile !== viewing
                  ? () => editFile(viewing)
                  : undefined
              }
              onShowHistory={
                viewing === null ? undefined : () => showFileHistory(viewing)
              }
              actions={
                <div
                  ref={setFileActionsSlot}
                  className="flex items-center gap-1"
                />
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}
