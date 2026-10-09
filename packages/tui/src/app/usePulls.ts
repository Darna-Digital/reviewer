import * as React from 'react';
import { checkoutPull } from '../git/actions';
import type { MergeMethod, PullRequestInfo } from '../github/client';
import {
  groupByBase,
  localBranchForPull,
  matchesPull,
} from '../github/pullStatus';
import type { Review } from './useReview';

export type Pulls = ReturnType<typeof usePulls>;

/**
 * The repository's open pull requests, read when first wanted and again on
 * refresh, plus what can be done to one — as the Mac app's Merge requests.
 */
export function usePulls(review: Review) {
  const { github, notify } = review;
  const [list, setList] = React.useState<PullRequestInfo[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState<number | null>(null);
  const [paneTop, setPaneTop] = React.useState(0);
  const [query, setQuery] = React.useState('');
  /** The list's highlight: the pull request under review, until j/k move it ahead of the diff. */
  const [cursor, setCursor] = React.useState<number | null>(null);
  /** The overview's last scrollable row, kept by the pane as it lays out. */
  const paneLimit = React.useRef(0);
  const ticket = React.useRef(0);

  const reload = React.useCallback(async () => {
    const mine = ++ticket.current;
    setLoading(true);
    try {
      const next = await github.pulls();
      if (mine !== ticket.current) return;
      setList(next);
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
  }, [github]);

  const shown =
    review.comparison.kind === 'pull' ? review.comparison.number : null;
  const groups = React.useMemo(
    () => groupByBase(list.filter((pull) => matchesPull(pull, query))),
    [list, query],
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
    pull: PullRequestInfo,
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
    byNumber: (number: number) =>
      list.find((pull) => pull.number === number) ?? null,
    query,
    setQuery,
    /** The sidebar's list: filtered by the search, grouped by target branch. */
    groups,
    ordered,
    cursor,
    /** Moves the highlight `delta` rows through the list and returns what it lands on. */
    step(delta: number): PullRequestInfo | undefined {
      const at = ordered.findIndex((pull) => pull.number === cursor);
      const from = at === -1 ? (delta > 0 ? -1 : ordered.length) : at;
      const next =
        ordered[Math.max(0, Math.min(ordered.length - 1, from + delta))];
      if (next) setCursor(next.number);
      return next;
    },
    /** The pull request under review, once the list has it. */
    shown:
      shown === null
        ? null
        : (list.find((pull) => pull.number === shown) ?? null),
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
    async checkout(pull: PullRequestInfo) {
      const branch = localBranchForPull(pull);
      return review.runGit(
        `Checking out #${pull.number}…`,
        () => checkoutPull(review.root, pull.number, branch),
        () => `Checked out ${branch}`,
      );
    },
    merge: (pull: PullRequestInfo, method: MergeMethod) =>
      act(pull, `Merging #${pull.number}…`, async () => {
        const result = await github.merge(pull.number, method);
        return result.message || `Merged #${pull.number}`;
      }),
    close: (pull: PullRequestInfo) =>
      act(pull, `Closing #${pull.number}…`, async () => {
        await github.close(pull.number);
        return `Closed #${pull.number}`;
      }),
  };
}
