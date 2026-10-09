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
import { listFiles, statusMap as readStatusMap } from '../git/files';
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
import type { GitHubClient } from '../github/client';
import type { NewComment, Store } from '../store/createStore';
import { targetKey, WORKTREE } from './comparison';
import type { Comparison } from './comparison';

export interface Notice {
  kind: 'info' | 'success' | 'error';
  text: string;
  at: number;
}

export type Review = ReturnType<typeof useReview>;

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
 */
export function useReview(
  root: string,
  store: Store,
  initial: Comparison,
  context: DiffContext,
) {
  const [repo, setRepo] = React.useState<RepoInfo | null>(null);
  const [status, setStatus] = React.useState<RepoStatus | null>(null);
  const [comparison, setComparisonState] = React.useState(initial);
  const [files, setFiles] = React.useState<FileDiff[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [commit, setCommit] = React.useState<CommitDetail | null>(null);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [defaultBranch, setDefaultBranch] = React.useState<string | null>(null);
  const [projectFiles, setProjectFiles] = React.useState<string[]>([]);
  const [statusMap, setStatusMap] = React.useState<Map<string, FileStatus>>(
    new Map(),
  );
  const [storeComments, setComments] = React.useState(() =>
    store.comments(root),
  );
  const [pullComments, setPullComments] = React.useState<ReviewComment[]>([]);
  const github = React.useMemo(() => githubClient(root), [root]);
  const [recent, setRecent] = React.useState<string[]>([]);
  const [, bumpAim] = React.useReducer((n: number) => n + 1, 0);
  const [notice, setNotice] = React.useState<Notice | null>(null);

  const sequence = React.useRef(0);
  const fingerprint = React.useRef('');
  const latest = React.useRef({ comparison });
  latest.current = { comparison };

  const notify = React.useCallback((kind: Notice['kind'], text: string) => {
    setNotice({ kind, text, at: Date.now() });
  }, []);

  const fail = React.useCallback(
    (error: unknown) =>
      notify('error', error instanceof Error ? error.message : String(error)),
    [notify],
  );

  const loadDiff = React.useCallback(
    async (target: Comparison, quiet = false) => {
      const ticket = ++sequence.current;
      if (!quiet) setLoading(true);
      try {
        const [next, detail] = await Promise.all([
          readDiff(root, target, context, github),
          target.kind === 'commit' ? readCommit(root, target.sha) : null,
        ]);
        if (ticket !== sequence.current) return;
        setFiles(next);
        setCommit(detail);
      } catch (error) {
        if (ticket !== sequence.current) return;
        fail(error);
        if (target.kind === 'branch') {
          setComparisonState(WORKTREE);
          void loadDiff(WORKTREE);
        }
      } finally {
        if (ticket === sequence.current) setLoading(false);
      }
    },
    [root, fail, context, github],
  );

  const loadRefs = React.useCallback(async () => {
    try {
      const [info, state, list, paths, statuses] = await Promise.all([
        repoInfo(root),
        repoStatus(root),
        listBranches(root),
        listFiles(root),
        readStatusMap(root),
      ]);
      setRepo(info);
      setStatus(state);
      setBranches(list);
      setProjectFiles(paths);
      setStatusMap(statuses);
      setDefaultBranch(await readDefaultBranch(root, list));
    } catch (error) {
      fail(error);
    }
  }, [root, fail]);

  const reloadComments = React.useCallback(() => {
    try {
      const next = store.comments(root);
      setComments((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    } catch {
      // the app may hold the write lock for a moment; the next tick reads it
    }
  }, [root, store]);

  const loadPullComments = React.useCallback(
    async (number: number, quiet = false) => {
      try {
        const next = await github.comments(number);
        const shown = latest.current.comparison;
        if (shown.kind !== 'pull' || shown.number !== number) return;
        setPullComments((prev) =>
          JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
        );
      } catch (error) {
        if (!quiet) fail(error);
      }
    },
    [github, fail],
  );

  /** A pull request lives on GitHub: local edits never change it, a forced refresh does. */
  const refresh = React.useCallback(
    async (force = false) => {
      const next = await worktreeFingerprint(root).catch(() => '');
      if (!force && next === fingerprint.current) return;
      fingerprint.current = next;
      const shown = latest.current.comparison;
      await Promise.all([
        loadRefs(),
        shown.kind !== 'pull' || force ? loadDiff(shown, true) : null,
        shown.kind === 'pull' && force ? loadPullComments(shown.number) : null,
      ]);
    },
    [root, loadRefs, loadDiff, loadPullComments],
  );

  React.useEffect(() => {
    void refresh(true);
  }, [refresh]);

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let watcher: FSWatcher | undefined;
    try {
      watcher = watch(root, { recursive: true }, (_event, name) => {
        if (name && IGNORED_PATHS.test(String(name))) return;
        clearTimeout(timer);
        timer = setTimeout(() => void refresh(), WATCH_DEBOUNCE_MS);
      });
    } catch {
      // no recursive watch here; the poll covers it
    }
    const statusPoll = setInterval(() => void refresh(), STATUS_POLL_MS);
    const commentPoll = setInterval(reloadComments, COMMENT_POLL_MS);
    return () => {
      watcher?.close();
      clearTimeout(timer);
      clearInterval(statusPoll);
      clearInterval(commentPoll);
    };
  }, [root, refresh, reloadComments]);

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
  const visibleComments = React.useMemo(
    () => comments.filter((comment) => comment.target === key),
    [comments, key],
  );
  // a prepared single-row read, re-run on every render
  const aim = repo?.branch ? store.branchAim(root, repo.branch) : null;

  function setComparison(next: Comparison) {
    if (next.kind === 'branch') {
      setRecent((list) =>
        [next.against, ...list.filter((ref) => ref !== next.against)].slice(
          0,
          RECENT_LIMIT,
        ),
      );
    }
    setComparisonState(next);
    setFiles([]);
    void loadDiff(next);
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
      if (target.startsWith('pr-') && target === key)
        return void onPull(
          (number) => github.comment(number, input),
          'Commented on GitHub',
        );
      mutate(
        () =>
          store.addComment(root, {
            ...input,
            author: repo?.user ?? 'you',
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
    updateComment(id: string, body: string) {
      mutate(() => store.updateComment(root, id, body), 'Comment updated');
    },
    removeComment(id: string) {
      mutate(() => store.removeComment(root, id), 'Comment deleted');
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
  root: string,
  comparison: Comparison,
  context: DiffContext,
  github: GitHubClient,
): Promise<FileDiff[]> {
  switch (comparison.kind) {
    case 'worktree':
      return worktreeDiff(root, context);
    case 'branch':
      return branchDiff(root, comparison.against, context);
    case 'commit':
      return commitDiff(root, comparison.sha, context);
    case 'pull':
      return sortByFolder(parseDiff(await github.diff(comparison.number)));
  }
}
