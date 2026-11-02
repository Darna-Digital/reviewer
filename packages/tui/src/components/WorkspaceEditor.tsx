import { useKeyboard } from '@opentui/react';
import { basename, dirname } from 'node:path';
import * as React from 'react';
import { keyName } from '../app/keys';
import type { Overlay } from '../app/useApp';
import { repoRoot } from '../git/repo';
import { reposOf } from '../repos/repos';
import { useListing } from '../workspace/useListing';
import type { Seg } from '../render/styled';
import { expandHome, foldHome, looksLikePath } from '../text/paths';
import { truncateStart } from '../text/measure';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';
import { Backdrop, centered } from './Modal';
import { Picker } from './Picker';
import type { PickerOption } from './Picker';

type EditorOverlay = Extract<Overlay, { kind: 'workspaceEditor' }>;
type AddOverlay = Extract<Overlay, { kind: 'addRepo' }>;
type Part = 'name' | 'repos';

const WIDTH = 76;
const MAX_LIST_ROWS = 10;
/** Title border, name label and field, gap, list heading, gap, error, buttons, border. */
const CHROME_ROWS = 9;
const ADD_LABEL = '+ Add repository…';
const ROW_BUTTONS = ' ↑  ↓  ✕ ';

const MOVE_KEYS: Record<string, -1 | 1> = {
  K: -1,
  J: 1,
  'alt+up': -1,
  'alt+down': 1,
  'shift+up': -1,
  'shift+down': 1,
};
const REMOVE_KEYS = new Set(['x', 'd', '-', 'delete', 'backspace']);

/**
 * The Mac app's workspace sheet: a name over the repositories in order.
 * ⇥ moves between the name and the list; in the list j/k move, J/K (or ⌥↑
 * ⌥↓) reorder, x removes, a adds; ⏎ or ⌃S saves, esc cancels. Every row's
 * ↑ ↓ ✕ and the buttons are clickable.
 */
export function WorkspaceEditor({ overlay }: { overlay: EditorOverlay }) {
  const { palette, screen, actions } = useAppContext();
  const [draft, setDraft] = React.useState(overlay.draft);
  const [part, setPart] = React.useState<Part>(
    overlay.draft.roots.length > 0 && overlay.draft.name ? 'repos' : 'name',
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const width = Math.min(WIDTH, screen.width - 4);
  const inner = width - 2;
  const rows = draft.roots.length + 1;
  const listRows = Math.min(MAX_LIST_ROWS, rows);
  const height = CHROME_ROWS + listRows;
  const top = Math.max(
    0,
    Math.min(draft.selected - listRows + 1, rows - listRows),
  );
  const onAdd = draft.selected === draft.roots.length;
  const names = reposOf(draft.roots).list.map((repo) => repo.name);

  useKeyboard((event) => {
    const key = keyName(event);
    if (key === 'escape') actions.closeOverlay();
    else if (key === 'ctrl+s' || key === 'cmd+return') void save();
    else if (key === 'tab' || key === 'shift+tab')
      setPart((at) => (at === 'name' ? 'repos' : 'name'));
    else if (part === 'name' && key === 'down') setPart('repos');
    else if (part === 'name' && key === 'return') void save();
    else if (part === 'name') return;
    else if (key === 'return') onAdd ? addRepo() : void save();
    else if (key === 'j' || key === 'down') select(draft.selected + 1);
    else if (key === 'k' || key === 'up')
      draft.selected === 0 ? setPart('name') : select(draft.selected - 1);
    else if (key === 'g' || key === 'home') select(0);
    else if (key === 'G' || key === 'end') select(rows - 1);
    else if (key === 'a' || key === '+') addRepo();
    else if (MOVE_KEYS[key]) move(draft.selected, MOVE_KEYS[key]);
    else if (REMOVE_KEYS.has(key)) remove(draft.selected);
    else return;
    event.preventDefault();
  });

  const title = draft.id === null ? 'New workspace' : 'Edit workspace';
  const label = (text: string, on: boolean): Seg[] => [
    { text: ` ${text}`, fg: on ? palette.accent : palette.muted, bold: on },
  ];

  return (
    <>
      <Backdrop onPress={actions.closeOverlay} zIndex={29} />
      <box
        position="absolute"
        left={centered(screen.width, width)}
        top={centered(screen.height, height)}
        width={width}
        height={height}
        zIndex={30}
        border
        borderStyle="rounded"
        borderColor={palette.accent}
        backgroundColor={palette.popover}
        title={` ${title} `}
        flexDirection="column"
      >
        <Line
          segs={label('Name', part === 'name')}
          width={inner}
          fill={palette.popover}
        />
        <box flexDirection="row" height={1} onMouseDown={() => setPart('name')}>
          <Line segs={[{ text: ' ' }]} width={1} fill={palette.popover} />
          <input
            focused={part === 'name'}
            value={draft.name}
            placeholder="Workspace"
            onInput={(name) => setDraft((all) => ({ ...all, name }))}
            width={inner - 2}
            backgroundColor={palette.control}
            focusedBackgroundColor={palette.control}
            textColor={palette.text}
            focusedTextColor={palette.text}
            placeholderColor={palette.faint}
            cursorColor={palette.accent}
          />
        </box>
        <Line segs={[]} width={inner} fill={palette.popover} />
        <Line
          segs={[
            ...label('Repositories', part === 'repos'),
            {
              text: `  ${draft.roots.length || 'none yet'} · J K reorder · x remove · a add`,
              fg: palette.faint,
            },
          ]}
          width={inner}
          fill={palette.popover}
        />
        {Array.from({ length: listRows }, (_, i) => top + i).map((index) =>
          index === draft.roots.length ? (
            <AddRow
              key="add"
              width={inner}
              lit={part === 'repos' && onAdd}
              onPress={addRepo}
            />
          ) : (
            <RepoRow
              key={draft.roots[index]}
              width={inner}
              index={index}
              name={names[index]!}
              root={draft.roots[index]!}
              lit={part === 'repos' && draft.selected === index}
              onSelect={() => {
                setPart('repos');
                select(index);
              }}
              onMove={(delta) => move(index, delta)}
              onRemove={() => remove(index)}
            />
          ),
        )}
        <Line segs={[]} width={inner} fill={palette.popover} />
        <Line
          segs={[{ text: error ? ` ${error}` : '', fg: palette.deleted }]}
          width={inner}
          fill={palette.popover}
        />
        <box flexDirection="row" height={1}>
          <Line
            segs={[{ text: ' ⏎ or ⌃S saves · esc cancels', fg: palette.faint }]}
            width={32}
            fill={palette.popover}
          />
          <box flexGrow={1} backgroundColor={palette.popover} />
          <Button
            segs={[
              { text: ' Cancel ', fg: palette.muted, bg: palette.control },
            ]}
            bg={palette.control}
            hoverTint={palette.text}
            onPress={actions.closeOverlay}
          />
          <Line segs={[{ text: ' ' }]} width={1} fill={palette.popover} />
          <Button
            segs={[
              {
                text: saving
                  ? ' Saving… '
                  : draft.id === null
                    ? ' Create '
                    : ' Save ',
                fg: palette.accentInk,
                bg: palette.accent,
                bold: true,
              },
            ]}
            bg={palette.accent}
            hoverTint={palette.text}
            onPress={() => void save()}
          />
          <Line segs={[{ text: ' ' }]} width={1} fill={palette.popover} />
        </box>
      </box>
    </>
  );

  function select(index: number) {
    setDraft((all) => ({
      ...all,
      selected: Math.max(0, Math.min(all.roots.length, index)),
    }));
  }

  function move(index: number, delta: -1 | 1) {
    const to = index + delta;
    if (index >= draft.roots.length || to < 0 || to >= draft.roots.length)
      return;
    const roots = [...draft.roots];
    [roots[index], roots[to]] = [roots[to]!, roots[index]!];
    setDraft((all) => ({ ...all, roots, selected: to }));
  }

  function remove(index: number) {
    if (index >= draft.roots.length) return;
    setDraft((all) => ({
      ...all,
      roots: all.roots.filter((_, i) => i !== index),
      selected: Math.min(index, all.roots.length - 1),
    }));
  }

  function addRepo() {
    actions.openOverlay({ kind: 'addRepo', draft });
  }

  async function save() {
    if (saving) return;
    const named = draft.name.trim()
      ? draft
      : {
          ...draft,
          name: draft.roots.length === 1 ? basename(draft.roots[0]!) : '',
        };
    setSaving(true);
    const problem = await actions.saveWorkspace(named);
    setSaving(false);
    if (problem) {
      setError(problem);
      if (problem.startsWith('Name')) setPart('name');
    }
  }
}

function RepoRow(props: {
  width: number;
  index: number;
  name: string;
  root: string;
  lit: boolean;
  onSelect: () => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const { palette } = useAppContext();
  const bg = props.lit ? palette.selection : palette.popover;
  const path = foldHome(props.root);
  const nameWidth = Math.max(10, Math.min(24, props.name.length + 2));
  const pathWidth = props.width - nameWidth - ROW_BUTTONS.length - 7;
  return (
    <box flexDirection="row" height={1} width={props.width}>
      <Line
        segs={[
          { text: props.lit ? ' ▌' : '  ', fg: palette.accent, bg },
          {
            text: `${String(props.index + 1).padStart(2)} `,
            fg: palette.faint,
            bg,
          },
          {
            text: props.name.padEnd(nameWidth).slice(0, nameWidth),
            fg: palette.text,
            bg,
            bold: props.lit,
          },
          { text: truncateStart(path, pathWidth), fg: palette.faint, bg },
        ]}
        width={props.width - ROW_BUTTONS.length}
        fill={bg}
        onMouseDown={props.onSelect}
      />
      <RowButton glyph=" ↑ " bg={bg} onPress={() => props.onMove(-1)} />
      <RowButton glyph=" ↓ " bg={bg} onPress={() => props.onMove(1)} />
      <RowButton glyph=" ✕ " bg={bg} danger onPress={props.onRemove} />
    </box>
  );
}

function RowButton(props: {
  glyph: string;
  bg: string;
  danger?: boolean;
  onPress: () => void;
}) {
  const { palette } = useAppContext();
  return (
    <Button
      segs={[
        {
          text: props.glyph,
          fg: props.danger ? palette.deleted : palette.muted,
          bg: props.bg,
        },
      ]}
      bg={props.bg}
      hoverTint={palette.text}
      onPress={props.onPress}
    />
  );
}

function AddRow(props: { width: number; lit: boolean; onPress: () => void }) {
  const { palette } = useAppContext();
  const bg = props.lit ? palette.selection : palette.popover;
  return (
    <Line
      segs={[
        { text: props.lit ? ' ▌' : '  ', fg: palette.accent, bg },
        { text: `   ${ADD_LABEL}`, fg: palette.accent, bg, bold: props.lit },
        { text: '   a', fg: palette.faint, bg },
      ]}
      width={props.width}
      fill={bg}
      onMouseDown={props.onPress}
    />
  );
}

const PATH_KEY = 'path';

/**
 * Repositories to add to the workspace being edited: the recent ones, then
 * every one the Mac app found on disk; a typed path adds the repository
 * there. Esc goes back to the editor.
 */
export function AddRepoPicker({ overlay }: { overlay: AddOverlay }) {
  const app = useAppContext();
  const { palette, actions, review } = app;
  const { draft } = overlay;
  const [query, setQuery] = React.useState('');
  const listed = useListing();
  const taken = new Set(draft.roots);
  const open = review.repos.list
    .map((repo) => repo.root)
    .filter((root) => !taken.has(root));
  const typedPath = looksLikePath(query) ? query.trim() : null;
  const option = (root: string, group: string): PickerOption => ({
    key: root,
    label: basename(root),
    group,
    search: `${basename(root)} ${root}`,
    hint: truncateStart(foldHome(dirname(root)), 38),
    hintColor: palette.faint,
  });
  const options: PickerOption[] = [
    ...(typedPath
      ? [
          {
            key: PATH_KEY,
            label: `Add ${typedPath}`,
            group: 'Path',
            search: query,
            labelColor: palette.accent,
          },
        ]
      : []),
    ...open.map((root) => option(root, 'Open now')),
    ...listed.recent
      .filter((root) => !taken.has(root) && !open.includes(root))
      .map((root) => option(root, 'Recent repositories')),
    ...listed.found
      .filter((root) => !taken.has(root) && !open.includes(root))
      .map((root) => option(root, 'All repositories')),
  ];
  const back = (roots = draft.roots) =>
    actions.openOverlay({
      kind: 'workspaceEditor',
      draft: { ...draft, roots, selected: Math.max(0, roots.length - 1) },
    });

  return (
    <Picker
      palette={palette}
      screen={app.screen}
      width={WIDTH}
      maxRows={16}
      title="Add repository"
      placeholder="Search repositories, or type a path like ~/code/app…"
      labelCut="middle"
      options={options}
      onQueryChange={setQuery}
      emptyText={
        listed.error ??
        (listed.loading
          ? 'Loading…'
          : 'Type a path to add the repository there')
      }
      footer={[
        { text: ' ~/path', fg: palette.muted },
        { text: ' adds a folder   ', fg: palette.faint },
        { text: 'esc', fg: palette.muted },
        { text: ' back to the workspace', fg: palette.faint },
      ]}
      onClose={() => back()}
      onPick={(picked) => {
        if (picked.key !== PATH_KEY) return back([...draft.roots, picked.key]);
        if (!typedPath) return;
        void repoRoot(expandHome(typedPath)).then(
          (root) =>
            taken.has(root)
              ? review.notify('info', `${basename(root)} is in it already`)
              : back([...draft.roots, root]),
          () => review.notify('error', `Not a git repository: ${typedPath}`),
        );
      }}
    />
  );
}
