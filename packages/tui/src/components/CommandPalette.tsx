import { useKeyboard } from '@opentui/react';
import * as React from 'react';
import { keyName } from '../app/keys';
import { paletteItems } from '../app/paletteItems';
import type { PaletteItem, Tone } from '../app/paletteItems';
import type { Overlay } from '../app/useApp';
import { MIN_QUERY, useTextSearch } from '../app/useTextSearch';
import type { GrepOptions } from '../git/files';
import { mix } from '../render/palette';
import type { Palette } from '../render/palette';
import { fitSegs, segsWidth } from '../render/styled';
import type { Seg } from '../render/styled';
import { MODES, trail } from '../search/paletteModes';
import type { PaletteMode } from '../search/paletteModes';
import { cellWidth, padStart, truncateStart } from '../text/measure';
import { useAppContext } from './AppContext';
import { Button, Line } from './Line';
import { Backdrop, centered } from './Modal';
import { useScrollWindow } from './useScrollWindow';
import { useWheel } from './useWheel';

type PaletteOverlay = Extract<Overlay, { kind: 'palette' }>;

interface Row {
  segs: Seg[];
  item: number | null;
}

const MAX_ROWS = 18;
const LEAD_WIDTH = 5;
const TOGGLES: Array<{ key: keyof GrepOptions; label: string; chord: string }> =
  [
    { key: 'caseSensitive', label: 'Aa', chord: 'alt+c' },
    { key: 'wholeWord', label: 'ab', chord: 'alt+w' },
    { key: 'regex', label: '.*', chord: 'alt+r' },
  ];

/** Each toggle is a space, then its label padded by a space either side. */
const TOGGLES_WIDTH = TOGGLES.reduce(
  (sum, toggle) => sum + 1 + toggle.label.length + 2,
  1,
);

/**
 * The Mac app's palette: Commands at the root, with Files, Search (text in
 * files) and Git › Branches under it. ⌫ on an empty field goes back up.
 */
export function CommandPalette({ overlay }: { overlay: PaletteOverlay }) {
  const app = useAppContext();
  const { palette, screen, actions, searchMemory } = app;
  const [mode, setMode] = React.useState<PaletteMode>(overlay.mode);
  const [query, setQuery] = React.useState(() =>
    remembered(overlay.mode, searchMemory),
  );
  const [index, setIndex] = React.useState(0);
  const options = searchMemory.options;
  const search = useTextSearch(
    app.review.root,
    mode === 'text' ? query : '',
    options,
  );
  const items = paletteItems({ app, mode, query, search, options });
  const selected = Math.min(index, items.length - 1);
  const parent = MODES[mode].parent;

  useKeyboard((event) => {
    const key = keyName(event);
    const toggle = TOGGLES.find((t) => t.chord === key);
    if (key === 'escape') actions.closeOverlay();
    else if (key === 'return') run(selected);
    else if (key === 'down' || key === 'ctrl+n') move(1);
    else if (key === 'up' || key === 'ctrl+p') move(-1);
    else if (key === 'pagedown') move(10, false);
    else if (key === 'pageup') move(-10, false);
    else if (key === 'home') setIndex(0);
    else if (key === 'end') setIndex(items.length - 1);
    else if (key === 'backspace' && query === '' && parent) enter(parent);
    else if (toggle && mode === 'text') flip(toggle.key);
    else if (key === 'cmd+e' || key === 'ctrl+k') {
      if (mode === 'commands') actions.closeOverlay();
      else enter('commands');
    } else return;
    event.preventDefault();
  });

  const width = Math.min(100, screen.width - 4);
  const inner = width - 2;
  const listRows = Math.max(3, Math.min(MAX_ROWS, screen.height - 10));
  const height = listRows + 6;
  const rows = layoutRows(palette, items, selected, inner);
  const selectedRow = rows.findIndex((row) => row.item === selected);
  const view = useScrollWindow(selectedRow, rows.length, listRows);
  const wheel = useWheel(view.scrollBy);
  const top = view.top;
  const bg = palette.popover;

  return (
    <>
      <Backdrop onPress={actions.closeOverlay} />
      <box
        position="absolute"
        left={centered(screen.width, width)}
        top={Math.max(1, Math.round(screen.height * 0.12))}
        width={width}
        height={height}
        zIndex={20}
        border
        borderStyle="rounded"
        borderColor={palette.accent}
        backgroundColor={bg}
        flexDirection="column"
        onMouseScroll={wheel}
      >
        <Crumbs mode={mode} width={inner} onPick={enter} />
        <box flexDirection="row" height={1}>
          <Line
            segs={[{ text: ' ⌕ ', fg: palette.accent }]}
            width={3}
            fill={bg}
          />
          <input
            key={mode}
            focused
            value={query}
            placeholder={MODES[mode].placeholder}
            onInput={(value) => {
              setQuery(value);
              setIndex(0);
              actions.rememberSearch(mode, value);
            }}
            width={inner - 3 - (mode === 'text' ? TOGGLES_WIDTH : 0)}
            backgroundColor={bg}
            focusedBackgroundColor={bg}
            textColor={palette.text}
            focusedTextColor={palette.text}
            placeholderColor={palette.faint}
            cursorColor={palette.accent}
          />
          {mode === 'text'
            ? TOGGLES.map((toggle) => {
                const on = options[toggle.key];
                const toggleBg = on
                  ? palette.accent
                  : mix(bg, palette.text, 0.06);
                return (
                  <box key={toggle.key} flexDirection="row" height={1}>
                    <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
                    <Button
                      segs={[
                        {
                          text: ` ${toggle.label} `,
                          fg: on ? palette.accentInk : palette.muted,
                          bg: toggleBg,
                          bold: on,
                        },
                      ]}
                      bg={toggleBg}
                      hoverTint={palette.text}
                      onPress={() => flip(toggle.key)}
                    />
                  </box>
                );
              })
            : null}
        </box>
        <Line
          segs={[{ text: '─'.repeat(inner), fg: palette.hairline }]}
          width={inner}
          fill={bg}
        />
        <box flexDirection="column" height={listRows}>
          {rows.length === 0 ? (
            <Line
              segs={[
                { text: `   ${emptyText()}`, fg: palette.faint, italic: true },
              ]}
              width={inner}
              fill={bg}
            />
          ) : (
            rows
              .slice(top, top + listRows)
              .map((row, i) => (
                <Line
                  key={top + i}
                  segs={row.segs}
                  width={inner}
                  fill={bg}
                  onMouseDown={() => row.item !== null && run(row.item)}
                  onMouseOver={() => row.item !== null && setIndex(row.item)}
                />
              ))
          )}
        </box>
        <Line segs={footer()} width={inner} fill={bg} />
      </box>
    </>
  );

  function move(delta: number, wrap = true) {
    if (items.length === 0) return;
    setIndex((i) => {
      const next = i + delta;
      if (wrap) return (next + items.length) % items.length;
      return Math.max(0, Math.min(items.length - 1, next));
    });
  }

  function enter(next: PaletteMode) {
    setMode(next);
    setQuery(remembered(next, searchMemory));
    setIndex(0);
  }

  function flip(key: keyof GrepOptions) {
    actions.setSearchOptions({ ...options, [key]: !options[key] });
  }

  function run(at: number) {
    const item = items[at];
    if (!item) return;
    if (item.opens) return enter(item.opens);
    actions.closeOverlay();
    item.run?.();
  }

  function emptyText(): string {
    const info = MODES[mode];
    if (mode === 'text') {
      if (search.failed) return 'Could not search this repository.';
      if (query.trim().length < MIN_QUERY) return info.idle!;
      if (search.searching) return 'Searching…';
    }
    if (info.idle && !query.trim()) return info.idle;
    return info.empty;
  }

  function footer(): Seg[] {
    const keys: Seg[] = [
      { text: ' ↑↓', fg: palette.muted },
      { text: ' move  ', fg: palette.faint },
      { text: '⏎', fg: palette.muted },
      { text: ' open  ', fg: palette.faint },
      ...(MODES[mode].parent
        ? [
            { text: '⌫', fg: palette.muted },
            { text: ' back  ', fg: palette.faint },
          ]
        : []),
      { text: 'esc', fg: palette.muted },
      { text: ' close', fg: palette.faint },
    ];
    if (mode !== 'text' || !search.result) return keys;
    const { matches, truncated } = search.result;
    const files = new Set(matches.map((match) => match.path)).size;
    const count = `${matches.length} ${matches.length === 1 ? 'match' : 'matches'} in ${files} ${files === 1 ? 'file' : 'files'}${truncated ? ' (first results only)' : ''}${search.searching ? ' · searching…' : ''} `;
    return fitSegs(
      [
        ...keys,
        {
          text: ' '.repeat(
            Math.max(1, inner - segsWidth(keys) - cellWidth(count)),
          ),
        },
        { text: count, fg: palette.faint },
      ],
      inner,
      bg,
    );
  }
}

function Crumbs({
  mode,
  width,
  onPick,
}: {
  mode: PaletteMode;
  width: number;
  onPick: (mode: PaletteMode) => void;
}) {
  const { palette } = useAppContext();
  const bg = palette.popover;
  const path = trail(mode);
  const used = path.reduce((sum, m) => sum + cellWidth(MODES[m].crumb) + 3, 1);
  return (
    <box flexDirection="row" height={1}>
      <Line segs={[{ text: ' ' }]} width={1} fill={bg} />
      {path.map((m, i) => {
        const last = i === path.length - 1;
        const label = MODES[m].crumb;
        return (
          <box key={m} flexDirection="row" height={1}>
            {last ? (
              <Line
                segs={[{ text: label, fg: palette.text, bold: true }]}
                width={cellWidth(label)}
                fill={bg}
              />
            ) : (
              <Button
                segs={[{ text: label, fg: palette.muted, bg }]}
                bg={bg}
                hoverTint={palette.text}
                onPress={() => onPick(m)}
              />
            )}
            {last ? null : (
              <Line
                segs={[{ text: ' › ', fg: palette.faint }]}
                width={3}
                fill={bg}
              />
            )}
          </box>
        );
      })}
      <Line segs={[]} width={Math.max(0, width - used)} fill={bg} />
    </box>
  );
}

function layoutRows(
  palette: Palette,
  items: PaletteItem[],
  selected: number,
  width: number,
): Row[] {
  const rows: Row[] = [];
  const hasLead = items.some((item) => item.lead);
  let group: string | undefined;
  items.forEach((item, index) => {
    if (item.group && item.group !== group) {
      group = item.group;
      rows.push({
        item: null,
        segs: [
          { text: ' ' },
          ...(item.groupIcon ?? []),
          {
            text: truncateStart(
              group,
              width - 2 - segsWidth(item.groupIcon ?? []),
            ),
            fg: palette.muted,
            bold: true,
          },
        ],
      });
    }
    const lit = index === selected;
    const bg = lit ? palette.selection : palette.popover;
    const tail = `${item.hint ?? ''}${lit ? ' ⏎' : '  '} `;
    const lead: Seg[] = hasLead
      ? [
          {
            text: `${padStart(item.lead ?? '', LEAD_WIDTH)}  `,
            fg: palette.faint,
            bg,
          },
        ]
      : [];
    const room = Math.max(4, width - 3 - segsWidth(lead) - cellWidth(tail));
    const label = fitSegs(
      item.label.map((part) => ({
        ...part,
        ...toneStyle(palette, part.tone, bg),
        ...(part.fg ? { fg: part.fg } : {}),
      })),
      room,
      bg,
    );
    rows.push({
      item: index,
      segs: fitSegs(
        [
          { text: lit ? '▌' : ' ', fg: palette.accent, bg },
          { text: ' ', bg },
          ...lead,
          ...label,
          { text: ' ', bg },
          { text: item.hint ?? '', fg: item.hintColor ?? palette.faint, bg },
          { text: lit ? ' ⏎ ' : '   ', fg: palette.accent, bg },
        ],
        width,
        bg,
      ),
    });
  });
  return rows;
}

function toneStyle(palette: Palette, tone: Tone | undefined, bg: string) {
  switch (tone) {
    case 'dim':
      return { fg: palette.faint, bg };
    case 'strong':
      return { fg: palette.text, bg, bold: true };
    case 'mark':
      return {
        fg: palette.text,
        bg: mix(bg, palette.accent, 0.35),
        bold: true,
      };
    default:
      return { fg: palette.text, bg };
  }
}

function remembered(
  mode: PaletteMode,
  memory: { files: string; text: string },
): string {
  if (mode === 'files') return memory.files;
  if (mode === 'text') return memory.text;
  return '';
}
