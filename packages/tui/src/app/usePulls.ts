import * as React from 'react';
import { checkoutPull } from '../git/actions';
import { githubClient } from '../github/client';
import type { MergeMethod, PullRequestInfo } from '../github/client';
import {
  groupByBase,
  localBranchForPull,
  matchesPull,
} from '../github/pullStatus';
import type { Repo } from '../repos/repos';
import type { Review } from './useReview';

export type Pulls = ReturnType<typeof usePulls>;

/** A pull request and the workspace repository it is open on. */
export interface RepoPull extends PullRequestInfo {
  repo: Repo;
  /** Unique across the workspace: two repositories can each have a #12. */
  key: string;
}

export interface PullGroup {
  key: string;
  title: string;
  pulls: RepoPull[];
}

export function pullKey(repo: Repo, number: number): string {
  return `${repo.root}#${number}`;
}

/**
 * The open pull requests of every repository on GitHub, read when first
 * wanted and again on refresh, plus what can be done to one — as the Mac
 * app's Merge requests.
 */
export function usePulls(review: Review) {
  const { repos, focused, notify } = review;
  const clients = React.useMemo(
    () => new Map(repos.list.map((repo) => [repo, githubClient(repo.root)])),
    [repos],
  );
  const [list, setList] = React.useState<RepoPull[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState<number | null>(null);
  const [paneTop, setPaneTop] = React.useState(0);
  const [query, setQuery] = React.useState('');
  /** The list's highlight: the pull request under review, until j/k move it ahead of the diff. */
  const [cursor, setCursor] = React.useState<string | null>(null);
  /** The overview's last scrollable row, kept by the pane as it lays out. */
  const paneLimit = React.useRef(0);
  const ticket = React.useRef(0);

  const reload = React.useCallback(async () => {
    const mine = ++ticket.current;
    setLoading(true);
    try {
      const read = await Promise.allSettled(
        repos.list.map(async (repo) =>
          (await clients.get(repo)!.pulls()).map((pull): RepoPull => ({
            ...pull,
            repo,
            key: pullKey(repo, pull.number),
          })),
        ),
      );
      if (mine !== ticket.current) return;
      const failed = read.find((result) => result.status === 'rejected');
      // a workspace's repositories off GitHub say nothing, as long as one answers
      if (failed && read.every((result) => result.status === 'rejected'))
        throw failed.reason;
      setList(
        read.flatMap((result) =>
          result.status === 'fulfilled' ? result.value : [],
        ),
      );
      setError(null);
    } catch (failure) {
      if (mine !== ticket.current) return;
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      if (mine === ticket.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  }, [repos, clients]);

  const shown =
    review.comparison.kind === 'pull'
      ? pullKey(focused, review.comparison.number)
      : null;
  const groups = React.useMemo(
    (): PullGroup[] =>
      repos.list.flatMap((repo) =>
        groupByBase(
          list.filter((pull) => pull.repo === repo && matchesPull(pull, query)),
        ).map(({ base, pulls }) => ({
          key: `${repo.root}:${base}`,
          title: repos.spans
            ? `${repo.name} › ${base || 'No branch'}`
            : base || 'No branch',
          pulls,
        })),
      ),
    [repos, list, query],
  );
  const ordered = groups.flatMap((group) => group.pulls);
  React.useEffect(() => {
    void reload();
  }, [reload]);
  React.useEffect(() => {
    setPaneTop(0);
    setCursor(shown);
  }, [shown]);

  /** One GitHub action at a time per pull request, reported as it goes. */
  async function act(
    pull: RepoPull,
    pending: string,
    run: () => Promise<string>,
  ): Promise<boolean> {
    if (busy !== null) {
      notify('info', `Still working on #${busy}`);
      return false;
    }
    setBusy(pull.number);
    notify('info', pending);
    try {
      notify('success', await run());
      return true;
    } catch (failure) {
      notify(
        'error',
        failure instanceof Error ? failure.message : String(failure),
      );
      return false;
    } finally {
      setBusy(null);
      void reload();
    }
  }

  return {
    list,
    loading,
    loaded,
    error,
    busy,
    reload,
    byKey: (key: string) => list.find((pull) => pull.key === key) ?? null,
    query,
    setQuery,
    /** The sidebar's list: filtered by the search, grouped by target branch. */
    groups,
    ordered,
    cursor,
    /** Moves the highlight `delta` rows through the list and returns what it lands on. */
    step(delta: number): RepoPull | undefined {
      const at = ordered.findIndex((pull) => pull.key === cursor);
      const from = at === -1 ? (delta > 0 ? -1 : ordered.length) : at;
      const next =
        ordered[Math.max(0, Math.min(ordered.length - 1, from + delta))];
      if (next) setCursor(next.key);
      return next;
    },
    /** The pull request under review, once the list has it. */
    shown:
      shown === null ? null : (list.find((pull) => pull.key === shown) ?? null),
    paneTop: Math.min(paneTop, paneLimit.current),
    paneLimit,
    scrollPane(delta: number) {
      setPaneTop((top) =>
        Math.max(
          0,
          Math.min(paneLimit.current, Math.min(top, paneLimit.current) + delta),
        ),
      );
    },
    async checkout(pull: RepoPull) {
      const branch = localBranchForPull(pull);
      return review.runGit(
        `Checking out #${pull.number}…`,
        () => checkoutPull(pull.repo.root, pull.number, branch),
        () => `Checked out ${branch}`,
      );
    },
    merge: (pull: RepoPull, method: MergeMethod) =>
      act(pull, `Merging #${pull.number}…`, async () => {
        const result = await clients.get(pull.repo)!.merge(pull.number, method);
        return result.message || `Merged #${pull.number}`;
      }),
    close: (pull: RepoPull) =>
      act(pull, `Closing #${pull.number}…`, async () => {
        await clients.get(pull.repo)!.close(pull.number);
        return `Closed #${pull.number}`;
      }),
  };
}
