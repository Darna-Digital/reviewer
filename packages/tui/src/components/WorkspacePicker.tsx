import { basename, dirname } from 'node:path';
import * as React from 'react';
import type { MenuEntry } from '../app/useApp';
import type { Seg } from '../render/styled';
import type { SavedWorkspace } from '../workspace/client';
import { useListing } from '../workspace/useListing';
import { foldHome, looksLikePath } from '../text/paths';
import { truncate, truncateStart } from '../text/measure';
import { ago } from '../text/time';
import { useAppContext } from './AppContext';
import { Picker } from './Picker';
import type { PickerOption } from './Picker';

const WIDTH = 84;
/** Hints give way to names: a row's path or repositories stop here. */
const HINT_CELLS = 38;
const RECENT = 8;
const CURRENT = 'current';
const NEW = 'new';
const SAVE = 'save';
const OPEN_PATH = 'path:open';
const ADD_PATH = 'path:add';
const SAVED = 'saved:';
const REPO = 'repo:';
const NEW_WORKSPACE = ' + New workspace…';

/**
 * The Mac app's workspace switcher: what is open, the saved workspaces, the
 * repositories opened lately and the rest found on disk. ⏎ opens one; → (or
 * tab, or a right-click) lists what else can be done with it; a typed path
 * opens the repository there.
 */
export function WorkspacePicker({ inert = false }: { inert?: boolean }) {
  const app = useAppContext();
  const { palette, review, actions, now } = app;
  const { repos } = review;
  const [query, setQuery] = React.useState('');
  const listed = useListing();
  const open = new Set(repos.list.map((repo) => repo.root));
  const others = listed.saved.filter(
    (saved) => saved.id !== repos.workspace?.id,
  );
  const recent = listed.recent
    .filter((root) => !open.has(root))
    .slice(0, RECENT);
  const everyOther = listed.found.filter(
    (root) => !open.has(root) && !recent.includes(root),
  );
  const typedPath = looksLikePath(query) ? query.trim() : null;

  const options: PickerOption[] = [
    ...(typedPath
      ? [
          {
            key: OPEN_PATH,
            label: `Open ${typedPath}`,
            group: 'Path',
            search: query,
            labelColor: palette.accent,
          },
          {
            key: ADD_PATH,
            label: `Add ${typedPath} to this workspace`,
            group: 'Path',
            search: query,
          },
        ]
      : []),
    {
      key: CURRENT,
      label: repos.workspace?.name ?? currentLabel(),
      group: 'Current',
      hint: repos.workspace
        ? repos.list.map((repo) => repo.name).join(', ')
        : repos.spans
          ? 'not saved as a workspace'
          : truncateStart(foldHome(repos.list[0]!.root), HINT_CELLS),
      labelColor: palette.text,
      hintColor: palette.faint,
    },
    ...(repos.spans && !repos.workspace
      ? [
          {
            key: SAVE,
            label: `Save ${currentLabel()} as a workspace…`,
            group: 'New',
            labelColor: palette.accent,
          },
        ]
      : []),
    {
      key: NEW,
      label: 'New workspace…',
      group: 'New',
      labelColor: palette.accent,
    },
    ...others.map((saved) => ({
      key: `${SAVED}${saved.id}`,
      label: saved.name,
      group: 'Workspaces',
      search: `${saved.name} ${saved.roots.map((root) => basename(root)).join(' ')}`,
      hint: [
        truncate(
          saved.roots.map((root) => basename(root)).join(', '),
          HINT_CELLS - 8,
        ),
        saved.openedAt ? ago(saved.openedAt, now) : '',
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    ...recent.map((root) => repoOption(root, 'Recent repositories')),
    ...everyOther.map((root) => repoOption(root, 'All repositories')),
  ];
  const footer: Seg[] = [
    { text: NEW_WORKSPACE, fg: palette.accent },
    { text: '   →', fg: palette.muted },
    { text: ' actions', fg: palette.faint },
    { text: '   ~/path', fg: palette.muted },
    { text: ' opens a folder', fg: palette.faint },
  ];

  return (
    <Picker
      palette={palette}
      screen={app.screen}
      width={WIDTH}
      maxRows={18}
      inert={inert}
      title="Open workspace"
      placeholder="Search workspaces and repositories, or type a path…"
      labelCut="middle"
      options={options}
      initialKey={others[0] ? `${SAVED}${others[0].id}` : CURRENT}
      onQueryChange={setQuery}
      footer={footer}
      onFooterPress={() => actions.editWorkspace({ roots: [] })}
      emptyText={
        listed.error ??
        (listed.loading
          ? 'Loading…'
          : 'Nothing matches — type a path to open a folder')
      }
      onClose={actions.closeOverlay}
      onKey={(key, picked, beside) => {
        if ((key === 'right' || key === 'tab') && picked) {
          menu(picked, beside);
          return true;
        }
        return false;
      }}
      onContextMenu={menu}
      onPick={pick}
    />
  );

  function currentLabel(): string {
    return repos.list.map((repo) => repo.name).join(', ');
  }

  function repoOption(root: string, group: string): PickerOption {
    return {
      key: `${REPO}${root}`,
      label: basename(root),
      group,
      search: basename(root),
      hint: truncateStart(foldHome(dirname(root)), HINT_CELLS),
      hintColor: palette.faint,
    };
  }

  function savedOf(key: string): SavedWorkspace | undefined {
    return listed.saved.find((saved) => `${SAVED}${saved.id}` === key);
  }

  function pick(picked: PickerOption) {
    const { key } = picked;
    if (key === CURRENT) return actions.closeOverlay();
    if (key === SAVE) return actions.editWorkspace();
    if (key === NEW) return actions.editWorkspace({ roots: [] });
    if (key === OPEN_PATH && typedPath) {
      actions.closeOverlay();
      return void actions.openPath(typedPath);
    }
    if (key === ADD_PATH && typedPath) {
      actions.closeOverlay();
      return void actions.openPath(typedPath, { add: true });
    }
    const saved = savedOf(key);
    actions.closeOverlay();
    if (saved) return actions.openSaved(saved);
    if (key.startsWith(REPO)) actions.openRepos([key.slice(REPO.length)]);
  }

  function menu(picked: PickerOption, at: { x: number; y: number }) {
    const entries = entriesFor(picked);
    if (entries.length > 0)
      actions.openMenu(at, entries, { kind: 'workspaces' });
  }

  function entriesFor(picked: PickerOption): MenuEntry[] {
    const saved = savedOf(picked.key);
    if (saved) {
      return [
        { label: 'Open', run: () => actions.openSaved(saved) },
        { label: 'Edit…', run: () => actions.editWorkspace(saved) },
        { separator: true },
        {
          label: 'Delete…',
          danger: true,
          run: () => actions.deleteWorkspace(saved),
        },
      ];
    }
    if (picked.key === CURRENT) {
      const current = repos.workspace
        ? listed.saved.find((one) => one.id === repos.workspace?.id)
        : undefined;
      return [
        current
          ? { label: 'Edit…', run: () => actions.editWorkspace(current) }
          : {
              label: 'Save as workspace…',
              disabled: !repos.spans,
              run: () => actions.editWorkspace(),
            },
        ...(repos.spans
          ? [
              { separator: true as const },
              ...repos.list.map((repo) => ({
                label: `Remove ${repo.name} from the workspace…`,
                run: () => actions.removeRepo(repo),
              })),
            ]
          : []),
        ...(current
          ? [
              { separator: true as const },
              {
                label: 'Delete…',
                danger: true,
                run: () => actions.deleteWorkspace(current),
              },
            ]
          : []),
      ];
    }
    if (picked.key.startsWith(REPO)) {
      const root = picked.key.slice(REPO.length);
      return [
        { label: 'Open on its own', run: () => actions.openRepos([root]) },
        {
          label: `Add to ${repos.workspace?.name ?? 'this workspace'}`,
          run: () =>
            actions.setWorkspaceRoots([
              ...repos.list.map((repo) => repo.root),
              root,
            ]),
        },
        {
          label: 'New workspace with it…',
          run: () =>
            actions.editWorkspace({
              roots: [...repos.list.map((repo) => repo.root), root],
            }),
        },
      ];
    }
    return [];
  }
}
