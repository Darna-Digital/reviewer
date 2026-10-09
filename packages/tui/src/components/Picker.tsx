import { useKeyboard } from '@opentui/react';
import * as React from 'react';
import { keyName } from '../app/keys';
import type { Palette } from '../render/palette';
import { cellWidth, truncate, truncateStart } from '../text/measure';
import { fitSegs } from '../render/styled';
import type { Seg } from '../render/styled';
import { Backdrop, centered } from './Modal';
import { Line } from './Line';
import { useScrollWindow } from './useScrollWindow';
import { useWheel } from './useWheel';

export interface PickerOption {
  key: string;
  label: string;
  /** Kept whole before the label, in a column of its own: a comment's line number. */
  lead?: string;
  /** Matched against the query in place of the label. */
  search?: string;
  /** Options are listed under their group's heading. */
  group?: string;
  hint?: string;
  hintColor?: string;
  labelColor?: string;
  /** A second, quieter row under the label — a comment's line of code. */
  detail?: string;
  detailColor?: string;
}

export interface PickerProps {
  palette: Palette;
  screen: { width: number; height: number };
  title: string;
  placeholder: string;
  options: PickerOption[];
  onPick: (option: PickerOption) => void;
  onClose: () => void;
  /** Extra footer row, e.g. a toggle; clicking it calls `onFooterPress`. */
  footer?: Seg[];
  onFooterPress?: () => void;
  /**
   * Extra keys, given the highlighted option and the cell just right of its
   * row (where a submenu opens); return `true` when handled.
   */
  onKey?: (
    key: string,
    option: PickerOption | undefined,
    beside: { x: number; y: number },
  ) => boolean;
  /** Right-click on an option. */
  onContextMenu?: (option: PickerOption, at: { x: number; y: number }) => void;
  /** Opens as a popover hanging from this cell instead of centred. */
  anchor?: { x: number; y: number };
  /** Popover width; defaults to a centred dialog's. */
  width?: number;
  /** Drawn under a menu opened from it: shown, but taking no input. */
  inert?: boolean;
  /** Group headings are file paths: shown as written, not as captions. */
  pathGroups?: boolean;
  /** Labels are prose, cut at the end; by default they are paths, cut at the start. */
  proseLabels?: boolean;
  /** List rows when the screen has room; defaults to a short list. */
  maxRows?: number;
  /** `false` when the caller filters (async search); defaults to fuzzy matching here. */
  filter?: boolean;
  onQueryChange?: (query: string) => void;
  emptyText?: string;
  /** Starts on this option, with this typed. */
  initialKey?: string;
  initialQuery?: string;
  /** Called as the selection moves, e.g. to preview it. */
  onHighlight?: (option: PickerOption) => void;
}

const MAX_ROWS = 14;
const RIGHT_BUTTON = 2;
/** The search field and the rule under it, above the list. */
const LIST_OFFSET = 2;

/** Fuzzy-filtered list with a search field; keyboard and mouse driven. */
export function Picker(props: PickerProps) {
  const { palette, screen } = props;
  const [query, setQuery] = React.useState(props.initialQuery ?? '');
  const [index, setIndex] = React.useState(() => {
    const shown =
      props.filter === false
        ? props.options
        : filterOptions(props.options, props.initialQuery ?? '');
    return Math.max(
      0,
      shown.findIndex((option) => option.key === props.initialKey),
    );
  });
  const options = React.useMemo(
    () =>
      props.filter === false
        ? props.options
        : filterOptions(props.options, query),
    [props.options, props.filter, query],
  );
  const selected = Math.min(index, options.length - 1);
  const highlighted = options[selected]?.key;
  const { onHighlight } = props;
  React.useEffect(() => {
    const option = options.find((candidate) => candidate.key === highlighted);
    if (option) onHighlight?.(option);
  }, [highlighted]);
  const move = (delta: number) =>
    setIndex((i) => Math.max(0, Math.min(options.length - 1, i + delta)));

  useKeyboard((event) => {
    if (props.inert) return;
    const key = keyName(event);
    if (key === 'escape') props.onClose();
    else if (key === 'return') pick(selected);
    else if (key === 'down' || key === 'ctrl+n') move(1);
    else if (key === 'up' || key === 'ctrl+p') move(-1);
    else if (key === 'pagedown') move(10);
    else if (key === 'pageup') move(-10);
    else if (!props.onKey?.(key, options[selected], besideSelected())) return;
    event.preventDefault();
  });

  const { anchor } = props;
  const width = Math.min(props.width ?? 76, screen.width - 4);
  const inner = width - 2;
  const chrome = 5 + (props.footer ? 1 : 0);
  const room = anchor
    ? screen.height - anchor.y - 1 - chrome
    : screen.height - 12;
  const listRows = Math.max(3, Math.min(props.maxRows ?? MAX_ROWS, room));
  const height = listRows + chrome;
  const left = anchor
    ? Math.max(0, Math.min(anchor.x, screen.width - width))
    : centered(screen.width, width);
  const boxTop = anchor
    ? Math.max(1, Math.min(anchor.y, screen.height - height))
    : Math.max(1, centered(screen.height, height) - 2);
  const rows = layoutRows(
    palette,
    options,
    selected,
    inner,
    props.pathGroups,
    props.proseLabels,
  );
  const selectedRow = rows.findIndex((row) => row.option === selected);
  const view = useScrollWindow(selectedRow, rows.length, listRows);
  const wheel = useWheel(view.scrollBy);
  const top = view.top;

  return (
    <>
      {props.inert ? null : <Backdrop onPress={props.onClose} />}
      <box
        position="absolute"
        left={left}
        top={boxTop}
        width={width}
        height={height}
        zIndex={20}
        border
        borderStyle="rounded"
        borderColor={palette.accent}
        backgroundColor={palette.popover}
        title={` ${props.title} `}
        flexDirection="column"
        onMouseScroll={wheel}
      >
        <box flexDirection="row" height={1}>
          <Line
            segs={[{ text: ' ⌕ ', fg: palette.accent }]}
            width={3}
            fill={palette.popover}
          />
          <input
            focused={!props.inert}
            value={query}
            placeholder={props.placeholder}
            onInput={(value) => {
              setQuery(value);
              setIndex(0);
              props.onQueryChange?.(value);
            }}
            width={inner - 3}
            backgroundColor={palette.popover}
            focusedBackgroundColor={palette.popover}
            textColor={palette.text}
            focusedTextColor={palette.text}
            placeholderColor={palette.faint}
            cursorColor={palette.accent}
          />
        </box>
        <Line
          segs={[{ text: '─'.repeat(inner), fg: palette.hairline }]}
          width={inner}
          fill={palette.popover}
        />
        <box flexDirection="column" height={listRows}>
          {rows.length === 0 ? (
            <Line
              segs={[
                {
                  text: `   ${props.emptyText ?? 'No matches'}`,
                  fg: palette.faint,
                  italic: true,
                },
              ]}
              width={inner}
              fill={palette.popover}
            />
          ) : (
            rows.slice(top, top + listRows).map((row, i) => (
              <Line
                key={top + i}
                segs={row.segs}
                width={inner}
                fill={palette.popover}
                onMouseDown={(event) => {
                  if (row.option === null) return;
                  const option = options[row.option];
                  if (event.button === RIGHT_BUTTON && option) {
                    setIndex(row.option);
                    props.onContextMenu?.(option, { x: event.x, y: event.y });
                  } else pick(row.option);
                }}
                onMouseOver={() => row.option !== null && setIndex(row.option)}
              />
            ))
          )}
        </box>
        {props.footer ? (
          <Line
            segs={props.footer}
            width={inner}
            fill={palette.popover}
            onMouseDown={props.onFooterPress}
          />
        ) : null}
        <Line
          segs={[
            { text: ' ↑↓', fg: palette.muted },
            { text: ' move  ', fg: palette.faint },
            { text: '⏎', fg: palette.muted },
            { text: ' pick  ', fg: palette.faint },
            { text: 'esc', fg: palette.muted },
            { text: ' close', fg: palette.faint },
            {
              text: `   ${options.length} ${options.length === 1 ? 'match' : 'matches'}`,
              fg: palette.faint,
            },
          ]}
          width={inner}
          fill={palette.popover}
        />
      </box>
    </>
  );

  function besideSelected() {
    const listTop = boxTop + 1 + LIST_OFFSET;
    return { x: left + width, y: listTop + Math.max(0, selectedRow - top) };
  }

  function pick(at: number) {
    const option = options[at];
    if (option) props.onPick(option);
  }
}

/** Matches best-first within their group, so each group keeps one heading. */
export function filterOptions(
  options: PickerOption[],
  query: string,
): PickerOption[] {
  const groups = [...new Set(options.map((option) => option.group ?? ''))];
  return options
    .map((option, index) => ({
      option,
      index,
      group: groups.indexOf(option.group ?? ''),
      score: matchScore(option.search ?? option.label, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => a.group - b.group || b.score - a.score || a.index - b.index)
    .map((entry) => entry.option);
}

/** Substrings first (earlier is better), then in-order letter matches. */
function matchScore(label: string, query: string): number {
  if (!query) return 1;
  const haystack = label.toLowerCase();
  const needle = query.toLowerCase();
  const at = haystack.indexOf(needle);
  if (at !== -1) return 1000 - at;
  let matched = 0;
  for (const char of haystack) if (char === needle[matched]) matched += 1;
  return matched === needle.length ? 1 : 0;
}

function layoutRows(
  palette: Palette,
  options: PickerOption[],
  selected: number,
  width: number,
  pathGroups = false,
  proseLabels = false,
): Array<{ segs: Seg[]; option: number | null }> {
  const rows: Array<{ segs: Seg[]; option: number | null }> = [];
  const leadWidth = Math.max(
    0,
    ...options.map((option) => cellWidth(option.lead ?? '')),
  );
  const leadColumn = leadWidth > 0 ? leadWidth + 2 : 0;
  let group: string | undefined;
  options.forEach((option, index) => {
    if (option.group && option.group !== group) {
      if (pathGroups && group !== undefined)
        rows.push({ option: null, segs: [] });
      group = option.group;
      rows.push({
        option: null,
        segs: pathGroups
          ? pathHeading(palette, group, width)
          : [
              {
                text: ` ${group.toUpperCase()}`,
                fg: palette.faint,
                bold: true,
              },
            ],
      });
    }
    const lit = index === selected;
    const bg = lit ? palette.selection : palette.popover;
    const hint = option.hint ?? '';
    const room = Math.max(4, width - 4 - leadColumn - cellWidth(hint));
    const label = proseLabels
      ? truncate(option.label, room)
      : truncateStart(option.label, room);
    const lead = option.lead ?? '';
    rows.push({
      option: index,
      segs: fitSegs(
        [
          { text: lit ? '▌' : ' ', fg: palette.accent, bg },
          { text: '  ', bg },
          ...(leadColumn > 0
            ? [
                {
                  text: `${' '.repeat(leadWidth - cellWidth(lead))}${lead}  `,
                  fg: lit ? palette.accent : palette.muted,
                  bg,
                },
              ]
            : []),
          { text: label, fg: option.labelColor ?? palette.text, bg, bold: lit },
          { text: ' '.repeat(Math.max(1, room - cellWidth(label) + 1)), bg },
          { text: hint, fg: option.hintColor ?? palette.faint, bg },
        ],
        width,
        bg,
      ),
    });
    if (option.detail !== undefined) {
      rows.push({
        option: index,
        segs: fitSegs(
          [
            { text: lit ? '▌' : ' ', fg: palette.accent, bg },
            {
              text: leadColumn > 0 ? ' '.repeat(2 + leadColumn) : '      ',
              bg,
            },
            {
              text: option.detail,
              fg: option.detailColor ?? palette.faint,
              bg,
            },
          ],
          width,
          bg,
        ),
      });
    }
  });
  return rows;
}

/** A file path heading: the name stands out, its folder stays quiet. */
function pathHeading(palette: Palette, path: string, width: number): Seg[] {
  const slash = path.lastIndexOf('/') + 1;
  const name = path.slice(slash);
  const folder = truncateStart(
    path.slice(0, slash),
    Math.max(0, width - 2 - cellWidth(name)),
  );
  return [
    { text: ` ${folder}`, fg: palette.faint },
    { text: name, fg: palette.text, bold: true },
  ];
}
