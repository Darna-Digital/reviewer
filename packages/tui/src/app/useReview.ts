import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import * as React from 'react';
import type { FileDiff } from '../diff/parseDiff';
import { branchDiff, commitDiff, worktreeDiff } from '../git/diff';
import { readCommit, readLog } from '../git/log';
import type { CommitDetail, LogRow } from '../git/log';
import {
  checkout as gitCheckout,
  defaultBranch as readDefaultBranch,
  listBranches,
} from '../git/refs';
import type { Branch } from '../git/refs';
import { repoInfo, repoStatus, worktreeFingerprint } from '../git/repo';
import type { RepoInfo, RepoStatus } from '../git/repo';
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
const STATUS_POLL_MS = 4000;
const WATCH_DEBOUNCE_MS = 250;
const LOG_LIMIT = 500;
const RECENT_LIMIT = 4;

/** Churn that never changes what a review shows. */
const IGNORED_PATHS =
  /(^|\/)(node_modules|\.git\/objects|\.git\/logs|\.turbo|\.next|dist|target|\.DS_Store)(\/|$)/;

/**
 * Repository state — HEAD, the diff under review, branches, history and
 * comments — kept live by a file watcher, a status poll and a comment poll.
 */
export function useReview(root: string, store: Store, initial: Comparison) {
  const [repo, setRepo] = React.useState<RepoInfo | null>(null);
  const [status, setStatus] = React.useState<RepoStatus | null>(null);
  const [comparison, setComparisonState] = React.useState(initial);
  const [files, setFiles] = React.useState<FileDiff[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [commit, setCommit] = React.useState<CommitDetail | null>(null);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [defaultBranch, setDefaultBranch] = React.useState<string | null>(null);
  const [log, setLog] = React.useState<LogRow[]>([]);
  const [logAll, setLogAll] = React.useState(false);
  const [comments, setComments] = React.useState(() => store.comments(root));
  const [recent, setRecent] = React.useState<string[]>([]);
  const [, bumpAim] = React.useReducer((n: number) => n + 1, 0);
  const [notice, setNotice] = React.useState<Notice | null>(null);

  const sequence = React.useRef(0);
  const fingerprint = React.useRef('');
  const latest = React.useRef({ comparison, logAll });
  latest.current = { comparison, logAll };

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
          readDiff(root, target),
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
    [root, fail],
  );

  const loadRefs = React.useCallback(async () => {
    try {
      const [info, state, list] = await Promise.all([
        repoInfo(root),
        repoStatus(root),
        listBranches(root),
      ]);
      setRepo(info);
      setStatus(state);
      setBranches(list);
      setDefaultBranch(await readDefaultBranch(root, list));
    } catch (error) {
      fail(error);
    }
  }, [root, fail]);

  const loadLog = React.useCallback(async () => {
    try {
      setLog(
        await readLog(root, { all: latest.current.logAll, limit: LOG_LIMIT }),
      );
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

  const refresh = React.useCallback(
    async (force = false) => {
      const next = await worktreeFingerprint(root).catch(() => '');
      if (!force && next === fingerprint.current) return;
      fingerprint.current = next;
      await Promise.all([
        loadRefs(),
        loadDiff(latest.current.comparison, true),
        loadLog(),
      ]);
    },
    [root, loadRefs, loadDiff, loadLog],
  );

  React.useEffect(() => {
    void refresh(true);
  }, [refresh]);

  React.useEffect(() => {
    void loadLog();
  }, [logAll, loadLog]);

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
    comparison,
    setComparison,
    files,
    loading,
    commit,
    branches,
    defaultBranch,
    log,
    logAll,
    setLogAll,
    comments,
    visibleComments,
    recent,
    aim,
    setAim,
    notice,
    notify,
    refresh: () => refresh(true),
    addComment(input: Omit<NewComment, 'author' | 'target'>) {
      mutate(
        () =>
          store.addComment(root, {
            ...input,
            author: repo?.user ?? 'you',
            target: key,
          }),
        'Comment added',
      );
    },
    updateComment(id: string, body: string) {
      mutate(() => store.updateComment(root, id, body), 'Comment updated');
    },
    removeComment(id: string) {
      mutate(() => store.removeComment(root, id), 'Comment deleted');
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

function readDiff(root: string, comparison: Comparison): Promise<FileDiff[]> {
  switch (comparison.kind) {
    case 'worktree':
      return worktreeDiff(root);
    case 'branch':
      return branchDiff(root, comparison.against);
    case 'commit':
      return commitDiff(root, comparison.sha);
  }
}
