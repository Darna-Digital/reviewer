import * as React from 'react';
import { layoutGraph } from '../git/graph';
import {
  isFilteredLog,
  readCommit,
  readCommitFiles,
  readLog,
} from '../git/log';
import type { CommitDetail, CommitFile, LogCommit } from '../git/log';
import type { Review } from './useReview';

export type History = ReturnType<typeof useHistory>;

const PAGE = 300;

/** The History pane: the log under its filters, and the selected commit. */
export function useHistory(review: Review, visible: boolean) {
  const [commits, setCommits] = React.useState<LogCommit[]>([]);
  const [all, setAll] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [path, setPath] = React.useState<string | null>(null);
  const [selectedSha, setSelectedSha] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<{
    commit: CommitDetail;
    files: CommitFile[];
  } | null>(null);
  const head = review.repo?.head;

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void readLog(review.root, { all, limit: PAGE, grep: query, path }).then(
      (next) => !cancelled && setCommits(next),
      () => !cancelled && setCommits([]),
    );
    return () => {
      cancelled = true;
    };
  }, [review.root, visible, all, query, path, head, review.branches]);

  React.useEffect(() => {
    if (!selectedSha) return setDetail(null);
    let cancelled = false;
    void Promise.all([
      readCommit(review.root, selectedSha),
      readCommitFiles(review.root, selectedSha),
    ]).then(
      ([commit, files]) => !cancelled && setDetail({ commit, files }),
      () => !cancelled && setDetail(null),
    );
    return () => {
      cancelled = true;
    };
  }, [review.root, selectedSha]);

  const filtered = isFilteredLog({ grep: query, path });
  const graph = React.useMemo(
    () => (filtered ? null : layoutGraph(commits)),
    [commits, filtered],
  );
  const selectedIndex = commits.findIndex(
    (commit) => commit.sha === selectedSha,
  );

  return {
    commits,
    /** One row per commit; `null` when filters make the parent links lie. */
    graph,
    all,
    toggleAll: () => setAll((on) => !on),
    query,
    setQuery,
    path,
    /** Narrows the log to one file (the tree's "Show history"). */
    setPath,
    selectedSha,
    selectedIndex,
    detail,
    select: setSelectedSha,
    /** Selects the commit `delta` away and returns its sha. */
    step(delta: number): string | null {
      const next =
        commits[
          Math.max(0, Math.min(commits.length - 1, selectedIndex + delta))
        ];
      if (!next) return null;
      setSelectedSha(next.sha);
      return next.sha;
    },
  };
}
