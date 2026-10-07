import { useKeyboard } from '@opentui/react';
import * as React from 'react';
import { keyName } from '../app/keys';
import type { Palette } from '../render/palette';
import { cellWidth, truncateStart } from '../text/measure';
import { fitSegs } from '../render/styled';
import type { Seg } from '../render/styled';
import { Backdrop, centered } from './Modal';
import { Line } from './Line';

export interface PickerOption {
  key: string;
  label: string;
  /** Options are listed under their group's heading. */
  group?: string;
  hint?: string;
  hintColor?: string;
  labelColor?: string;
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
  /** Extra keys; return `true` when handled. */
  onKey?: (key: string) => boolean;
  /** `false` when the caller filters (async search); defaults to fuzzy matching here. */
  filter?: boolean;
  onQueryChange?: (query: string) => void;
  emptyText?: string;
}

const MAX_ROWS = 14;
const WHEEL_STEP = 1;

/** Fuzzy-filtered list with a search field; keyboard and mouse driven. */
export function Picker(props: PickerProps) {
  const { palette, screen } = props;
  const [query, setQuery] = React.useState('');
  const [index, setIndex] = React.useState(0);
  const options = React.useMemo(
    () =>
      props.filter === false
        ? props.options
        : filterOptions(props.options, query),
    [props.options, props.filter, query],
  );
  const selected = Math.min(index, options.length - 1);
  const move = (delta: number) =>
    setIndex((i) => Math.max(0, Math.min(options.length - 1, i + delta)));

  useKeyboard((event) => {
    const key = keyName(event);
    if (key === 'escape') props.onClose();
    else if (key === 'return') pick(selected);
    else if (key === 'down' || key === 'ctrl+n') move(1);
    else if (key === 'up' || key === 'ctrl+p') move(-1);
    else if (key === 'pagedown') move(10);
    else if (key === 'pageup') move(-10);
    else if (!props.onKey?.(key)) return;
    event.preventDefault();
  });

  const width = Math.min(76, screen.width - 4);
  const inner = width - 2;
  const listRows = Math.max(3, Math.min(MAX_ROWS, screen.height - 12));
  const height = listRows + 5 + (props.footer ? 1 : 0);
  const rows = layoutRows(palette, options, selected, inner);
  const selectedRow = rows.findIndex((row) => row.option === selected);
  const top = Math.max(
    0,
    Math.min(selectedRow - listRows + 2, rows.length - listRows),
  );

  return (
    <>
      <Backdrop onPress={props.onClose} />
      <box
        position="absolute"
        left={centered(screen.width, width)}
        top={Math.max(1, centered(screen.height, height) - 2)}
        width={width}
        height={height}
        zIndex={20}
        border
        borderStyle="rounded"
        borderColor={palette.accent}
        backgroundColor={palette.popover}
        title={` ${props.title} `}
        flexDirection="column"
        onMouseScroll={(event) => {
          if (event.scroll?.direction === 'up') move(-WHEEL_STEP);
          if (event.scroll?.direction === 'down') move(WHEEL_STEP);
        }}
      >
        <box flexDirection="row" height={1}>
          <Line
            segs={[{ text: ' ⌕ ', fg: palette.accent }]}
            width={3}
            fill={palette.popover}
          />
          <input
            focused
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
            rows
              .slice(top, top + listRows)
              .map((row, i) => (
                <Line
                  key={top + i}
                  segs={row.segs}
                  width={inner}
                  fill={palette.popover}
                  onMouseDown={() => row.option !== null && pick(row.option)}
                  onMouseOver={() =>
                    row.option !== null && setIndex(row.option)
                  }
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
      score: matchScore(option.label, query),
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
): Array<{ segs: Seg[]; option: number | null }> {
  const rows: Array<{ segs: Seg[]; option: number | null }> = [];
  let group: string | undefined;
  options.forEach((option, index) => {
    if (option.group && option.group !== group) {
      group = option.group;
      rows.push({
        option: null,
        segs: [
          { text: ` ${group.toUpperCase()}`, fg: palette.faint, bold: true },
        ],
      });
    }
    const lit = index === selected;
    const bg = lit ? palette.selection : palette.popover;
    const hint = option.hint ?? '';
    const room = Math.max(4, width - 4 - cellWidth(hint));
    const label = truncateStart(option.label, room);
    rows.push({
      option: index,
      segs: fitSegs(
        [
          { text: lit ? '▌' : ' ', fg: palette.accent, bg },
          { text: '  ', bg },
          { text: label, fg: option.labelColor ?? palette.text, bg, bold: lit },
          { text: ' '.repeat(Math.max(1, room - cellWidth(label) + 1)), bg },
          { text: hint, fg: option.hintColor ?? palette.faint, bg },
        ],
        width,
        bg,
      ),
    });
  });
  return rows;
}
