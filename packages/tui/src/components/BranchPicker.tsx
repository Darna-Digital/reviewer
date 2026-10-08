import * as React from 'react';
import type { Overlay } from '../app/useApp';
import type { Branch } from '../git/refs';
import type { Seg } from '../render/styled';
import { ago } from '../text/time';
import { useAppContext } from './AppContext';
import { Picker } from './Picker';
import type { PickerOption } from './Picker';

type BranchesOverlay = Extract<Overlay, { kind: 'branches' }>;

const RECENT = 5;
const CREATE = 'create';
const WIDTH = 64;

/**
 * The branch popover under the sidebar's branch chip: Recent, Local and
 * Remote. ⏎ checks out; → (or tab, or a right-click) opens the branch's
 * actions beside it, ← comes back;
 * a name no branch has yet offers to create it.
 */
export function BranchPicker({
  overlay,
  inert = false,
}: {
  overlay: BranchesOverlay;
  inert?: boolean;
}) {
  const app = useAppContext();
  const { palette, review, actions, branches, now } = app;
  const [query, setQuery] = React.useState(overlay.query ?? '');
  const newName = query.trim().replace(/\s+/g, '-');
  const current = review.repo?.branch;
  const byName = new Map(review.branches.map((b) => [b.name, b]));
  const compared =
    review.comparison.kind === 'branch' ? review.comparison.against : null;

  const locals = review.branches.filter((branch) => !branch.remote);
  const remotes = review.branches.filter((branch) => branch.remote);
  const sorted = (list: Branch[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name));
  const options: PickerOption[] = [
    ...(query ? [] : locals.slice(0, RECENT).map((b) => option(b, 'Recent'))),
    ...sorted(locals).map((b) => option(b, 'Local')),
    ...sorted(remotes).map((b) => option(b, 'Remote')),
    ...(newName && !byName.has(newName)
      ? [
          {
            key: CREATE,
            label: `+ Create branch ‘${newName}’`,
            group: 'New',
            hint: current ? `from ${current}` : '',
            labelColor: palette.accent,
          },
        ]
      : []),
  ];
  const footer: Seg[] = [
    { text: ' + New branch…', fg: palette.accent },
    { text: '   →', fg: palette.muted },
    { text: ' actions', fg: palette.faint },
  ];

  return (
    <Picker
      palette={palette}
      screen={app.screen}
      anchor={overlay.at}
      width={WIDTH}
      inert={inert}
      title={current ? `⎇ ${current}` : 'Branches'}
      placeholder="Switch to a branch…"
      options={options}
      initialKey={
        overlay.highlighted ?? (current ? `Recent:${current}` : undefined)
      }
      initialQuery={overlay.query}
      onQueryChange={setQuery}
      footer={footer}
      onFooterPress={() => actions.newBranch()}
      onKey={(key, picked, beside) => {
        if ((key !== 'right' && key !== 'tab') || !picked) return false;
        openMenu(picked, beside);
        return true;
      }}
      onContextMenu={openMenu}
      onClose={actions.closeOverlay}
      onPick={(picked) => {
        actions.closeOverlay();
        if (picked.key === CREATE) return void branches.create(newName);
        const branch = branchOf(picked);
        if (branch && !branch.current) void branches.checkout(branch);
      }}
    />
  );

  function option(branch: Branch, group: string): PickerOption {
    const state = branch.current
      ? 'current'
      : branch.name === compared
        ? '● comparing'
        : '';
    const hint = [
      state,
      branch.ahead ? `↑${branch.ahead}` : '',
      branch.behind ? `↓${branch.behind}` : '',
      branch.gone ? 'gone' : '',
      ago(branch.committedAt, now),
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      key: `${group}:${branch.name}`,
      label: branch.name,
      group,
      hint,
      hintColor:
        branch.current || branch.name === compared ? palette.accent : undefined,
      labelColor: branch.current ? palette.added : undefined,
    };
  }

  function branchOf(picked: PickerOption): Branch | undefined {
    return byName.get(picked.key.slice(picked.key.indexOf(':') + 1));
  }

  function openMenu(picked: PickerOption, at: { x: number; y: number }) {
    const branch = branchOf(picked);
    if (branch)
      actions.branchMenu(branch, at, {
        ...overlay,
        highlighted: picked.key,
        query,
      });
  }
}
