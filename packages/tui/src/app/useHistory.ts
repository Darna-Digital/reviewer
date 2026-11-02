import * as React from 'react';
import { layoutGraph } from '../git/graph';
import {
  isFilteredLog,
  readCommit,
  readCommitFiles,
  readLog,
} from '../git/log';
import type { CommitDetail, CommitFile, LogCommit } from '../git/log';
import { inRepo, locate } from '../repos/repos';
import type { Review } from './useReview';

export type History = ReturnType<typeof useHistory>;

const PAGE = 300;
/** How long the selection rests before its details are read. */
const DETAIL_SETTLE_MS = 120;

/** The History pane: the focused repository's log under its filters, and the selected commit. */
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
  const latestSelected = React.useRef(selectedSha);
  const { repos, focused } = review;
  const pathInRepo = path === null ? null : locate(repos, path).path;

  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    void readLog(focused.root, {
      all,
      limit: PAGE,
      grep: query,
      path: pathInRepo,
    }).then(
      (next) => !cancelled && setCommits(next),
      () => !cancelled && setCommits([]),
    );
    return () => {
      cancelled = true;
    };
  }, [focused, visible, all, query, pathInRepo, head, review.branches]);

  React.useEffect(() => {
    setSelectedSha(null);
    setPath((shown) =>
      shown !== null && locate(repos, shown).repo !== focused ? null : shown,
    );
  }, [repos, focused]);

  React.useEffect(() => {
    if (!selectedSha) return setDetail(null);
    let cancelled = false;
    const settle = setTimeout(() => {
      void Promise.all([
        readCommit(focused.root, selectedSha),
        readCommitFiles(focused.root, selectedSha),
      ]).then(
        ([commit, files]) =>
          !cancelled &&
          setDetail({
            commit,
            files: files.map((file) => ({
              ...file,
              path: inRepo(repos, focused, file.path),
              oldPath:
                file.oldPath === null
                  ? null
                  : inRepo(repos, focused, file.oldPath),
            })),
          }),
        () => !cancelled && setDetail(null),
      );
    }, DETAIL_SETTLE_MS);
    return () => {
      cancelled = true;
      clearTimeout(settle);
    };
  }, [repos, focused, selectedSha]);

  const filtered = isFilteredLog({ grep: query, path });
  const graph = React.useMemo(
    () => (filtered ? null : layoutGraph(commits)),
    [commits, filtered],
  );
  function select(sha: string | null) {
    latestSelected.current = sha;
    setSelectedSha(sha);
  }

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
    select,
    /** Selects the commit `delta` away and returns its sha. */
    step(delta: number): string | null {
      const at = commits.findIndex(
        (commit) => commit.sha === latestSelected.current,
      );
      const next =
        commits[Math.max(0, Math.min(commits.length - 1, at + delta))];
      if (!next) return null;
      select(next.sha);
      return next.sha;
    },
  };
}
