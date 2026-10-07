import * as React from 'react';
import {
  createBranch,
  deleteBranch,
  merge,
  rebase,
  renameBranch,
  summarize,
} from '../git/actions';
import { checkout } from '../git/refs';
import type { Branch } from '../git/refs';
import type { Review } from './useReview';

export type Branches = ReturnType<typeof useBranches>;
export type BranchSection = 'Recent' | 'Local' | 'Remote';

export interface BranchRow {
  section: BranchSection;
  branch: Branch;
}

const RECENT = 5;

/** The Branches pane: Recent, Local and Remote sections, and the branch actions. */
export function useBranches(review: Review) {
  const [query, setQuery] = React.useState('');
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null);
  const [remoteOpen, setRemoteOpen] = React.useState(false);

  const rows = React.useMemo((): BranchRow[] => {
    const needle = query.trim().toLowerCase();
    const match = (branch: Branch) =>
      !needle || branch.name.toLowerCase().includes(needle);
    const locals = review.branches.filter(
      (branch) => !branch.remote && match(branch),
    );
    const remotes = review.branches.filter(
      (branch) => branch.remote && match(branch),
    );
    const byName = (a: Branch, b: Branch) => a.name.localeCompare(b.name);
    return [
      ...(needle
        ? []
        : locals
            .slice(0, RECENT)
            .map((branch) => ({ section: 'Recent' as const, branch }))),
      ...[...locals]
        .sort(byName)
        .map((branch) => ({ section: 'Local' as const, branch })),
      ...(remoteOpen || needle
        ? [...remotes]
            .sort(byName)
            .map((branch) => ({ section: 'Remote' as const, branch }))
        : []),
    ];
  }, [review.branches, query, remoteOpen]);

  const selectedIndex = Math.max(
    0,
    rows.findIndex((row) => rowKey(row) === selectedKey),
  );
  const selected = rows[selectedIndex]?.branch;
  const { root } = review;
  const current =
    review.branches.find((branch) => branch.current)?.name ?? 'HEAD';

  return {
    rows,
    query,
    setQuery,
    remoteOpen,
    remoteCount: review.branches.filter((branch) => branch.remote).length,
    toggleRemote: () => setRemoteOpen((open) => !open),
    selectedIndex,
    selected,
    select: (row: BranchRow) => setSelectedKey(rowKey(row)),
    step(delta: number) {
      const row =
        rows[Math.max(0, Math.min(rows.length - 1, selectedIndex + delta))];
      if (row) setSelectedKey(rowKey(row));
    },
    checkout: (branch: Branch) =>
      review.runGit(
        `Checking out ${branch.name}…`,
        () => checkout(root, branch, review.branches),
        (name) => `Checked out ${name}`,
      ),
    create: (name: string, from?: string) =>
      review.runGit(
        `Creating ${name}…`,
        () => createBranch(root, name, from),
        () => `Created and checked out ${name}`,
      ),
    merge: (branch: Branch) =>
      review.runGit(
        `Merging ${branch.name} into ${current}…`,
        () => merge(root, branch.name),
        (out) => summarize(out, `Merged ${branch.name}`),
      ),
    rebase: (branch: Branch) =>
      review.runGit(
        `Rebasing ${current} onto ${branch.name}…`,
        () => rebase(root, branch.name),
        () => `Rebased onto ${branch.name}`,
      ),
    rename: (branch: Branch, to: string) =>
      review.runGit(
        `Renaming ${branch.name}…`,
        () => renameBranch(root, branch.name, to),
        () => `Renamed to ${to}`,
      ),
    remove: (branch: Branch) =>
      review.runGit(
        `Deleting ${branch.name}…`,
        () => deleteBranch(root, branch.name),
        () => `Deleted ${branch.name}`,
      ),
  };
}

function rowKey(row: BranchRow): string {
  return `${row.section}:${row.branch.name}`;
}
