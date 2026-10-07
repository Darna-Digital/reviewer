import * as React from 'react';
import { readCommit, readCommitFiles, readLog } from '../git/log';
import type { CommitDetail, CommitFile, LogRow } from '../git/log';
import type { Review } from './useReview';

export type History = ReturnType<typeof useHistory>;

const PAGE = 300;

/** The History pane: the log under its filters, and the selected commit. */
export function useHistory(review: Review, visible: boolean) {
  const [rows, setRows] = React.useState<LogRow[]>([]);
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
      (next) => !cancelled && setRows(next),
      () => !cancelled && setRows([]),
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

  const commits = rows.filter((row) => row.commit);
  const selectedIndex = commits.findIndex(
    (row) => row.commit?.sha === selectedSha,
  );

  return {
    rows,
    all,
    toggleAll: () => setAll((on) => !on),
    query,
    setQuery,
    path,
    /** Narrows the log to one file (the tree's "Show history"). */
    setPath,
    selectedSha,
    detail,
    select: setSelectedSha,
    step(delta: number) {
      const next =
        commits[
          Math.max(0, Math.min(commits.length - 1, selectedIndex + delta))
        ];
      if (next?.commit) setSelectedSha(next.commit.sha);
    },
  };
}
