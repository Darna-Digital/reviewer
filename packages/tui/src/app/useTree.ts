import * as React from 'react';
import type { FileStatus } from '../git/files';
import {
  ancestorsOf,
  buildTree,
  filterTree,
  findNode,
  flattenTree,
} from '../tree/fileTree';
import type { TreeNode, TreeRow } from '../tree/fileTree';
import type { Review } from './useReview';
import type { Surface } from './useWorkspace';

export type Tree = ReturnType<typeof useTree>;

const DIFF_STATUS: Record<string, FileStatus> = {
  added: 'added',
  deleted: 'deleted',
  modified: 'modified',
  renamed: 'renamed',
};

/**
 * The sidebar tree: the whole project (folders start collapsed) on Browse,
 * the changed files (folders start open, filterable) on Review.
 */
export function useTree(surface: Surface, review: Review, follow?: string) {
  const [browseOpen, setBrowseOpen] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  const [reviewClosed, setReviewClosed] = React.useState<ReadonlySet<string>>(
    new Set(),
  );
  const [query, setQuery] = React.useState('');
  const [selection, setSelection] = React.useState<
    Record<Surface, string | null>
  >({
    browse: null,
    review: null,
  });

  const { files, projectFiles, statusMap } = review;
  const nodes = React.useMemo(() => {
    if (surface === 'browse') {
      return buildTree(
        projectFiles.map((path) => ({ path, status: statusMap.get(path) })),
      );
    }
    return buildTree(
      files.map((file) => ({
        path: file.path,
        status:
          statusMap.get(file.path) === 'untracked'
            ? 'untracked'
            : DIFF_STATUS[file.status],
      })),
    );
  }, [surface, files, projectFiles, statusMap]);

  const isOpen = React.useCallback(
    (node: TreeNode) =>
      surface === 'browse'
        ? browseOpen.has(node.path)
        : !reviewClosed.has(node.path),
    [surface, browseOpen, reviewClosed],
  );
  const rows: TreeRow[] = React.useMemo(
    () =>
      flattenTree(
        surface === 'review' ? filterTree(nodes, query) : nodes,
        isOpen,
      ),
    [nodes, query, surface, isOpen],
  );

  const selectedPath = follow ?? selection[surface];
  const selected = Math.max(
    0,
    rows.findIndex((row) => row.node.path === selectedPath),
  );

  return {
    rows,
    nodes,
    query,
    setQuery,
    selected,
    selectedNode: rows[selected]?.node,
    select(path: string) {
      setSelection((all) => ({ ...all, [surface]: path }));
    },
    step(delta: number): TreeNode | undefined {
      const row =
        rows[Math.max(0, Math.min(rows.length - 1, selected + delta))];
      if (row) setSelection((all) => ({ ...all, [surface]: row.node.path }));
      return row?.node;
    },
    setOpen(node: TreeNode, open: boolean) {
      if (node.kind !== 'dir') return;
      if (surface === 'browse')
        setBrowseOpen((set) => toggled(set, node.path, open));
      else setReviewClosed((set) => toggled(set, node.path, !open));
    },
    isOpen,
    /** Opens the folders above `path` and selects it. */
    reveal(path: string) {
      if (surface === 'browse') {
        setBrowseOpen((set) => new Set([...set, ...ancestorsOf(path)]));
      }
      setSelection((all) => ({ ...all, [surface]: path }));
    },
    /** The node's parent folder row, for `h` on a file or closed folder. */
    parentOf(path: string): TreeNode | undefined {
      const ancestors = ancestorsOf(path);
      for (let i = ancestors.length - 1; i >= 0; i -= 1) {
        const node = findNode(nodes, ancestors[i]!);
        if (node) return node;
      }
      return undefined;
    },
  };
}

function toggled(
  set: ReadonlySet<string>,
  key: string,
  on: boolean,
): ReadonlySet<string> {
  const next = new Set(set);
  if (on) next.add(key);
  else next.delete(key);
  return next;
}
