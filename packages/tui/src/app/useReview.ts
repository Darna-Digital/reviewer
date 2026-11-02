import type { ReviewComment } from '@reviewer/core/comments';
import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import * as React from 'react';
import { parseDiff } from '../diff/parseDiff';
import type { FileDiff } from '../diff/parseDiff';
import {
  branchDiff,
  commitDiff,
  sortByFolder,
  worktreeDiff,
} from '../git/diff';
import type { DiffContext } from '../git/diff';
import type { FileStatus } from '../git/files';
import { readCommit } from '../git/log';
import type { CommitDetail } from '../git/log';
import {
  checkout as gitCheckout,
  defaultBranch as readDefaultBranch,
  listBranches,
} from '../git/refs';
import type { Branch } from '../git/refs';
import { repoInfo, repoStatus, worktreeFingerprint } from '../git/repo';
import type { RepoInfo, RepoStatus } from '../git/repo';
import { githubClient, githubCommentId } from '../github/client';
import { listRepoFiles, repoStatusMap } from '../repos/repoFiles';
import { inRepo, locate, repoAt } from '../repos/repos';
import type { Repo, Repos } from '../repos/repos';
import type { NewComment, Store } from '../store/createStore';
import { targetKey, WORKTREE } from './comparison';
import type { Comparison } from './comparison';

export interface Notice {
  kind: 'info' | 'success' | 'error';
  text: string;
  at: number;
}

export type Review = ReturnType<typeof useReview>;

/** What the sidebar's chips and the repository picker show of each repository. */
export interface RepoState {
  info: RepoInfo;
  status: RepoStatus;
  branches: Branch[];
  defaultBranch: string | null;
}

const COMMENT_POLL_MS = 1500;
/** GitHub's rate limit is shared with everything else the token does. */
const PULL_COMMENT_POLL_MS = 30_000;
const STATUS_POLL_MS = 4000;
const WATCH_DEBOUNCE_MS = 250;
const RECENT_LIMIT = 4;

/** Churn that never changes what a review shows. */
const IGNORED_PATHS =
  /(^|\/)(node_modules|\.git\/objects|\.git\/logs|\.turbo|\.next|dist|target|\.DS_Store)(\/|$)/;

/**
 * Repository state — HEAD, the diff under review, branches, history and
 * comments — kept live by a file watcher, a status poll and a comment poll.
 *
 * Over a workspace of several repositories the uncommitted work, the files
 * and the comments span them all, under workspace paths; a branch, a commit
 * or a pull request is the focused repository's, as are `repo`, `status`
 * and `branches`.
 */
export function useReview(
  repos: Repos,
  store: Store,
  initial: Comparison,
  context: DiffContext,
  initialFocus = repos.list[0]!.root,
) {
  const [focusRoot, setFocusRoot] = React.useState(initialFocus);
  const focused = repoAt(repos, focusRoot) ?? repos.list[0]!;
  const { root } = focused;
  const [states, setStates] = React.useState<ReadonlyMap<string, RepoState>>(
    new Map(),
  );
  const [comparison, setComparisonState] = React.useState(initial);
  const [files, setFiles] = React.useState<FileDiff[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [commit, setCommit] = React.useState<CommitDetail | null>(null);
  const [projectFiles, setProjectFiles] = React.useState<string[]>([]);
  const [statusMap, setStatusMap] = React.useState<Map<string, FileStatus>>(
    new Map(),
  );
  const [storeComments, setComments] = React.useState(() =>
    readComments(store, repos),
  );
  const [pullComments, setPullComments] = React.useState<ReviewComment[]>([]);
  const github = React.useMemo(() => githubClient(root), [root]);
  const [recentByRoot, setRecent] = React.useState<
    Readonly<Record<string, string[]>>
  >({});
  const recent = recentByRoot[root] ?? [];
  const [, bumpAim] = React.useReducer((n: number) => n + 1, 0);
  const [notice, setNotice] = React.useState<Notice | null>(null);

  const sequence = React.useRef(0);
  const fingerprint = React.useRef('');
  const latest = React.useRef({ comparison, focused });
  latest.current = { comparison, focused };

  const notify = React.useCallback((kind: Notice['kind'], text: string) => {
    setNotice({ kind, text, at: Date.now() });
  }, []);

  const fail = React.useCallback(
    (error: unknown) =>
      notify('error', error instanceof Error ? error.message : String(error)),
    [notify],
  );

  const loadDiff = React.useCallback(
    async (target: Comparison, quiet = false, at = latest.current.focused) => {
      const ticket = ++sequence.current;
      if (!quiet) setLoading(true);
      try {
        const [next, detail] = await Promise.all([
          readDiff(repos, at, target, context),
          target.kind === 'commit' ? readCommit(at.root, target.sha) : null,
        ]);
        if (ticket !== sequence.current) return;
        setFiles(next);
        setCommit(detail);
      } catch (error) {
        if (ticket !== sequence.current) return;
        fail(error);
        if (target.kind === 'branch') {
          setComparisonState(WORKTREE);
          void loadDiff(WORKTREE, false, at);
        }
      } finally {
        if (ticket === sequence.current) setLoading(false);
      }
    },
    [repos, fail, context],
  );

  const loadRefs = React.useCallback(async () => {
    try {
      const [read, paths, statuses] = await Promise.all([
        Promise.all(repos.list.map((repo) => readRepoState(repo.root))),
        listRepoFiles(repos),
        repoStatusMap(repos),
      ]);
      setStates(new Map(read.map((state) => [state.info.root, state])));
      setProjectFiles(paths);
      setStatusMap(statuses);
    } catch (error) {
      fail(error);
    }
  }, [repos, fail]);

  const reloadComments = React.useCallback(() => {
    try {
      const next = readComments(store, repos);
      setComments((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    } catch {
      // the app may hold the write lock for a moment; the next tick reads it
    }
  }, [repos, store]);

  const loadPullComments = React.useCallback(
    async (number: number, quiet = false) => {
      try {
        const at = latest.current.focused;
        const next = (await github.comments(number)).map((comment) => ({
          ...comment,
          filePath: inRepo(repos, at, comment.filePath),
        }));
        const shown = latest.current.comparison;
        if (shown.kind !== 'pull' || shown.number !== number) return;
        if (latest.current.focused !== at) return;
        setPullComments((prev) =>
          JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
        );
      } catch (error) {
        if (!quiet) fail(error);
      }
    },
    [github, repos, fail],
  );

  /** A pull request lives on GitHub: local edits never change it, a forced refresh does. */
  const refresh = React.useCallback(
    async (force = false) => {
      const next = (
        await Promise.all(
          repos.list.map((repo) =>
            worktreeFingerprint(repo.root).catch(() => ''),
          ),
        )
      ).join('\0');
      if (!force && next === fingerprint.current) return;
      fingerprint.current = next;
      const shown = latest.current.comparison;
      await Promise.all([
        loadRefs(),
        shown.kind !== 'pull' || force ? loadDiff(shown, true) : null,
        shown.kind === 'pull' && force ? loadPullComments(shown.number) : null,
      ]);
    },
    [repos, loadRefs, loadDiff, loadPullComments],
  );

  React.useEffect(() => {
    void refresh(true);
  }, [refresh]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watchers: FSWatcher[] = [];
    for (const repo of repos.list) {
      try {
        watchers.push(
          watch(repo.root, { recursive: true }, (_event, name) => {
            if (name && IGNORED_PATHS.test(String(name))) return;
            clearTimeout(timer);
            timer = setTimeout(() => void refresh(), WATCH_DEBOUNCE_MS);
          }),
        );
      } catch {
        // no recursive watch here; the poll covers it
      }
    }
    const statusPoll = setInterval(() => void refresh(), STATUS_POLL_MS);
    const commentPoll = setInterval(reloadComments, COMMENT_POLL_MS);
    return () => {
      for (const watcher of watchers) watcher.close();
      clearTimeout(timer);
      clearInterval(statusPoll);
      clearInterval(commentPoll);
    };
  }, [repos, refresh, reloadComments]);

  const pullNumber = comparison.kind === 'pull' ? comparison.number : null;
  React.useEffect(() => {
    setPullComments([]);
    if (pullNumber === null) return;
    void loadPullComments(pullNumber);
    const poll = setInterval(
      () => void loadPullComments(pullNumber, true),
      PULL_COMMENT_POLL_MS,
    );
    return () => clearInterval(poll);
  }, [pullNumber, loadPullComments]);

  const comments = React.useMemo(
    () => [...storeComments, ...pullComments],
    [storeComments, pullComments],
  );
  const key = targetKey(comparison);
  const spansRepos = comparison.kind === 'worktree';
  const visibleComments = React.useMemo(
    () =>
      comments.filter(
        (comment) =>
          comment.target === key &&
          (spansRepos || locate(repos, comment.filePath).repo === focused),
      ),
    [comments, key, spansRepos, repos, focused],
  );
  const state = states.get(root);
  const repo = state?.info ?? null;
  const status = state?.status ?? null;
  const branches = state?.branches ?? [];
  const defaultBranch = state?.defaultBranch ?? null;
  // a prepared single-row read, re-run on every render
  const aim = repo?.branch ? store.branchAim(root, repo.branch) : null;

  /** `at` moves the focus with it: a commit or pull request is one repository's. */
  function setComparison(next: Comparison, at: Repo = focused) {
    if (next.kind === 'branch') {
      setRecent((all) => ({
        ...all,
        [at.root]: [
          next.against,
          ...(all[at.root] ?? []).filter((ref) => ref !== next.against),
        ].slice(0, RECENT_LIMIT),
      }));
    }
    if (at !== focused) {
      setFocusRoot(at.root);
      latest.current = { comparison: next, focused: at };
    }
    setComparisonState(next);
    setFiles([]);
    void loadDiff(next, false, at);
  }

  /** Records `target` as where the current branch is aimed (`null` clears it). */
  function setAim(target: string | null) {
    if (!repo?.branch) return;
    store.setBranchAim(root, repo.branch, target);
    bumpAim();
  }

  /** Runs a GitHub call on the pull request on screen, then re-reads its comments. */
  async function onPull(
    run: (number: number) => Promise<unknown>,
    done: string,
  ): Promise<boolean> {
    if (pullNumber === null) return false;
    try {
      await run(pullNumber);
      await loadPullComments(pullNumber);
      notify('success', done);
      return true;
    } catch (error) {
      fail(error);
      return false;
    }
  }

  function mutate(run: () => void, done: string) {
    try {
      run();
      reloadComments();
      notify('success', done);
    } catch (error) {
      fail(error);
    }
  }

  return {
    repos,
    /** The repository the branch chip, history and git actions are about. */
    focused,
    /** Focuses `repo`; a branch, commit or pull request of the last one gives way to the uncommitted work. */
    focus(next: Repo) {
      if (next === focused) return;
      if (comparison.kind !== 'worktree') return setComparison(WORKTREE, next);
      setFocusRoot(next.root);
      latest.current = { comparison, focused: next };
    },
    stateOf: (of: Repo) => states.get(of.root) ?? null,
    root,
    repo,
    status,
    projectFiles,
    statusMap,
    comparison,
    setComparison,
    files,
    loading,
    commit,
    branches,
    defaultBranch,
    comments,
    visibleComments,
    recent,
    aim,
    setAim,
    notice,
    notify,
    refresh: () => refresh(true),
    github,
    /** Files under the comparison on screen unless `target` names another; a pull request's go to GitHub. */
    addComment(input: Omit<NewComment, 'author' | 'target'>, target = key) {
      const at = locate(repos, input.filePath);
      const inside = { ...input, filePath: at.path };
      if (target.startsWith('pr-') && target === key)
        return void onPull(
          (number) => github.comment(number, inside),
          'Commented on GitHub',
        );
      mutate(
        () =>
          store.addComment(at.repo.root, {
            ...inside,
            author: states.get(at.repo.root)?.info.user ?? 'you',
            target,
          }),
        'Comment added',
      );
    },
    /** Runs a git action, reporting how it went, then re-reads the repository. */
    async runGit(
      pending: string,
      action: () => Promise<string | void>,
      done: (output: string) => string,
    ): Promise<boolean> {
      notify('info', pending);
      let ok = false;
      try {
        notify('success', done((await action()) ?? ''));
        ok = true;
      } catch (error) {
        fail(error);
      }
      await refresh(true);
      return ok;
    },
    updateComment(comment: ReviewComment, body: string) {
      const owner = locate(repos, comment.filePath).repo.root;
      mutate(
        () => store.updateComment(owner, comment.id, body),
        'Comment updated',
      );
    },
    removeComment(comment: ReviewComment) {
      const owner = locate(repos, comment.filePath).repo.root;
      mutate(() => store.removeComment(owner, comment.id), 'Comment deleted');
    },
    replyToComment(comment: ReviewComment, body: string) {
      const id = githubCommentId(comment);
      if (id !== null)
        void onPull(
          (number) => github.reply(number, id, body),
          'Replied on GitHub',
        );
    },
    deletePullComment(comment: ReviewComment) {
      const id = githubCommentId(comment);
      if (id !== null)
        void onPull(
          (number) => github.deleteComment(number, id),
          'Comment deleted on GitHub',
        );
    },
    setThreadResolved(comment: ReviewComment, resolved: boolean) {
      const thread = comment.thread;
      if (thread)
        void onPull(
          (number) => github.resolveThread(number, thread, resolved),
          resolved ? 'Thread resolved' : 'Thread reopened',
        );
    },
    async checkout(branch: Branch) {
      try {
        const name = await gitCheckout(root, branch, branches);
        notify('success', `Switched to ${name}`);
        await refresh(true);
      } catch (error) {
        fail(error);
      }
    },
  };
}

async function readDiff(
  repos: Repos,
  focused: Repo,
  comparison: Comparison,
  context: DiffContext,
): Promise<FileDiff[]> {
  if (comparison.kind === 'worktree' && repos.spans) {
    const each = await Promise.all(
      repos.list.map(async (repo) =>
        placeDiff(repos, repo, await worktreeDiff(repo.root, context)),
      ),
    );
    return each.flat();
  }
  return placeDiff(
    repos,
    focused,
    await readRepoDiff(focused.root, comparison, context),
  );
}

async function readRepoDiff(
  root: string,
  comparison: Comparison,
  context: DiffContext,
): Promise<FileDiff[]> {
  switch (comparison.kind) {
    case 'worktree':
      return worktreeDiff(root, context);
    case 'branch':
      return branchDiff(root, comparison.against, context);
    case 'commit':
      return commitDiff(root, comparison.sha, context);
    case 'pull':
      return sortByFolder(
        parseDiff(await githubClient(root).diff(comparison.number)),
      );
  }
}

function placeDiff(repos: Repos, repo: Repo, files: FileDiff[]): FileDiff[] {
  if (!repos.spans) return files;
  return files.map((file) => ({
    ...file,
    path: inRepo(repos, repo, file.path),
    oldPath: file.oldPath === null ? null : inRepo(repos, repo, file.oldPath),
  }));
}

async function readRepoState(root: string): Promise<RepoState> {
  const [info, status, branches] = await Promise.all([
    repoInfo(root),
    repoStatus(root),
    listBranches(root),
  ]);
  return {
    info,
    status,
    branches,
    defaultBranch: await readDefaultBranch(root, branches),
  };
}

/** Every repository's notes, their files as workspace paths. */
function readComments(store: Store, repos: Repos): ReviewComment[] {
  return repos.list.flatMap((repo) =>
    store.comments(repo.root).map((comment) => ({
      ...comment,
      filePath: inRepo(repos, repo, comment.filePath),
    })),
  );
}
