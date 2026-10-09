import type { ReviewComment } from '@reviewer/core/comments';
import * as React from 'react';
import {
  anchorFor,
  buildLayout,
  commentKey,
  stopAtRow,
  stopKey,
} from '../diff/buildLayout';
import type { Anchor, Stop, ViewMode } from '../diff/buildLayout';
import type { Theme } from '../diff/highlight';
import { inlineChangesOf } from '../diff/inlineChanges';
import type { DiffLine, FileDiff } from '../diff/parseDiff';
import { identifiers } from '../language/identifier';
import type { Identifier } from '../language/identifier';
import type { CursorSide, PaintContext } from '../render/diffRows';
import type { FileIcons } from '../render/fileIcons';
import type { Palette } from '../render/palette';
import { useHighlights } from './useHighlights';

export type DiffView = ReturnType<typeof useDiffView>;

interface DiffViewOptions {
  files: FileDiff[];
  comments: ReviewComment[];
  width: number;
  /** Rows available to the scrolling part of the pane. */
  height: number;
  palette: Palette;
  icons: FileIcons;
  theme: Theme;
  themeName: string;
  focused: boolean;
  now: number;
  wrap: boolean;
  setWrap: React.Dispatch<React.SetStateAction<boolean>>;
  /** Pins the view mode, e.g. `file` for the browse viewer. */
  fixedView?: ViewMode;
}

/** Rows kept between the cursor and the pane's edge. */
const MARGIN = 3;
/** Columns kept beside a symbol the word cursor scrolls to. */
const WORD_MARGIN = 4;
/** Room left after the longest line when scrolled all the way. */
const EDGE_ROOM = 4;
const FOLD_LINES = 1500;
const GENERATED =
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?|Cargo\.lock|Gemfile\.lock|poetry\.lock|composer\.lock|go\.sum)$|\.min\.(js|css)$|\.map$/;

/**
 * The diff pane's state: layout, cursor and viewport. The cursor is a stop
 * remembered by key, so it stays put when the layout is rebuilt underneath.
 */
export function useDiffView(opts: DiffViewOptions) {
  const { files, comments, width, height } = opts;
  const [chosenView, setView] = React.useState<ViewMode>('unified');
  const view = opts.fixedView ?? chosenView;
  const { wrap, setWrap } = opts;
  const [showComments, setShowComments] = React.useState(true);
  const [folds, setFolds] = React.useState<ReadonlyMap<string, boolean>>(
    new Map(),
  );
  const [cursor, setCursor] = React.useState(0);
  const [side, setSide] = React.useState<CursorSide>('right');
  const [scrollX, setScrollX] = React.useState(0);
  /** The symbol picked on the cursor's line, by the line's stop key and start. */
  const [word, setWord] = React.useState<{ key: string; start: number } | null>(
    null,
  );
  const pendingWord = React.useRef<{ key: string; name: string } | null>(null);
  const [, redraw] = React.useReducer((n: number) => n + 1, 0);
  const top = React.useRef(0);
  const pendingKey = React.useRef<string | null>(null);
  const cursorKey = React.useRef<string | null>(null);

  const collapsed = React.useMemo(() => {
    const set = new Set<string>();
    for (const file of files) {
      if (folds.get(file.path) ?? isFoldedByDefault(file)) set.add(file.path);
    }
    return set;
  }, [files, folds]);

  const layout = React.useMemo(
    () =>
      buildLayout({
        files,
        comments,
        width,
        view,
        wrap,
        collapsed,
        showComments,
      }),
    [files, comments, width, view, wrap, collapsed, showComments],
  );
  const { rows, stops } = layout;
  const longest = React.useMemo(() => longestLine(files), [files]);
  const maxScrollX = wrap
    ? 0
    : Math.max(0, longest - layout.geometry.codeWidth + EDGE_ROOM);
  const shiftX = Math.min(scrollX, maxScrollX);

  let current = clamp(cursor, 0, stops.length - 1);
  const lastLayout = React.useRef(layout);
  if (lastLayout.current !== layout) {
    lastLayout.current = layout;
    const wanted = pendingKey.current ?? cursorKey.current;
    const found = wanted ? stops.findIndex((stop) => stop.key === wanted) : -1;
    if (found !== -1) {
      if (pendingKey.current)
        top.current = Math.max(0, stops[found]!.row - MARGIN);
      pendingKey.current = null;
      current = found;
    }
    if (current !== cursor) setCursor(current);
  }
  const stop: Stop | undefined = stops[current];
  cursorKey.current = stop?.key ?? null;
  keepInView(stop);

  const commentIndex = React.useMemo(() => {
    const byPath = new Map<string, Map<string, number>>();
    for (const comment of comments) {
      const counts = byPath.get(comment.filePath) ?? new Map<string, number>();
      const key = commentKey(comment.side, comment.lineNumber);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      byPath.set(comment.filePath, counts);
    }
    return byPath;
  }, [comments]);

  const tokensOf = useHighlights({
    files,
    rows,
    top: top.current,
    height,
    collapsed,
    theme: opts.theme,
    themeName: opts.themeName,
  });

  const here = stop ? lineOf(stop) : null;
  const cursorWord =
    here && stop && word?.key === stop.key
      ? (identifiers(here.line.text).find((w) => w.start === word.start) ??
        null)
      : null;

  React.useEffect(() => {
    const wanted = pendingWord.current;
    if (!wanted || !stop || stop.key !== wanted.key) return;
    pendingWord.current = null;
    const line = lineOf(stop);
    const found = line
      ? identifiers(line.line.text).find((w) => w.name === wanted.name)
      : undefined;
    if (found) selectWord(stop.key, found);
  });

  const paint: PaintContext = {
    palette: opts.palette,
    icons: opts.icons,
    files,
    geometry: layout.geometry,
    width,
    view,
    collapsed,
    focused: opts.focused,
    cursorSide: side,
    scrollX: shiftX,
    cursorWord:
      cursorWord && here && stop
        ? {
            file: stop.file,
            hunk: here.hunk,
            line: here.index,
            start: cursorWord.start,
            end: cursorWord.end,
          }
        : null,
    now: opts.now,
    tokensOf,
    inlineOf: (index) => inlineChangesOf(files[index]!),
    commentsAt,
    commentsIn,
  };

  return {
    layout,
    stop,
    cursor: current,
    top: top.current,
    height,
    view,
    wrap,
    /** Columns scrolled sideways; always 0 while wrapping. */
    scrollX: shiftX,
    scrollXBy: (delta: number) =>
      setScrollX((x) => clamp(Math.min(x, maxScrollX) + delta, 0, maxScrollX)),
    showComments,
    collapsed,
    side,
    paint,
    commentsIn,
    setView,
    setWrap,
    setShowComments,
    setSide,
    moveTo,
    moveBy: (delta: number) => moveTo(current + delta),
    toTop: () => moveTo(0),
    toBottom: () => moveTo(stops.length - 1),
    page,
    scrollBy,
    jumpToFile,
    nextFile: () =>
      jumpToFile(Math.min(files.length - 1, (stop?.file ?? -1) + 1)),
    prevFile: () => {
      const file = stop?.file ?? 0;
      jumpToFile(Math.max(0, stop?.target.kind === 'file' ? file - 1 : file));
    },
    nextHunk: () => moveToHunk(1),
    prevHunk: () => moveToHunk(-1),
    nextComment: () => moveToComment(1),
    prevComment: () => moveToComment(-1),
    toggleFold,
    unfold: (path: string) => {
      if (collapsed.has(path)) setFolds((map) => new Map(map).set(path, false));
    },
    landOn,
    /** Moves to new-side line `line` of `path` if the diff shows it. */
    landOnLine(path: string, line: number): boolean {
      const index = stops.findIndex((candidate) => {
        if (candidate.target.kind !== 'line') return false;
        const file = files[candidate.file];
        if (file?.path !== path) return false;
        const { hunk, left, right } = candidate.target;
        return file.hunks[hunk]?.lines[right ?? left ?? -1]?.newNo === line;
      });
      if (index === -1) return false;
      landOn(stops[index]!.key);
      return true;
    },
    anchorAtCursor,
    /** The symbol under the word cursor, with its line. */
    cursorWord: cursorWord && here ? { ...here, identifier: cursorWord } : null,
    /** `w` / `b`: the next or previous symbol, on to the next line with one. */
    wordStep(step: 1 | -1) {
      if (here && stop) {
        const words = identifiers(here.line.text);
        const from = cursorWord?.start ?? (step > 0 ? -1 : Infinity);
        const next =
          step > 0
            ? words.find((w) => w.start > from)
            : words.findLast((w) => w.start < from);
        if (next) return selectWord(stop.key, next);
      }
      const index = findStop(step, (candidate) => {
        const line = lineOf(candidate);
        return !!line && identifiers(line.line.text).length > 0;
      });
      if (index === -1) return;
      const line = lineOf(stops[index]!)!;
      const words = identifiers(line.line.text);
      moveTo(index);
      selectWord(stops[index]!.key, step > 0 ? words[0]! : words.at(-1)!);
    },
    /** `0` / `$`: the first or last symbol on the line. */
    wordEdge(edge: 'first' | 'last') {
      if (!here || !stop) return;
      const words = identifiers(here.line.text);
      const pick = edge === 'first' ? words[0] : words.at(-1);
      if (pick) selectWord(stop.key, pick);
    },
    /** `*` / `#`: the next or previous line using the symbol under the cursor. */
    occurrence(step: 1 | -1): boolean {
      const name =
        cursorWord?.name ??
        (here ? identifiers(here.line.text)[0]?.name : undefined);
      if (!name) return false;
      const index = findStop(step, (candidate) => {
        const line = lineOf(candidate);
        return (
          !!line && identifiers(line.line.text).some((w) => w.name === name)
        );
      });
      if (index === -1) return false;
      const found = identifiers(lineOf(stops[index]!)!.line.text).find(
        (w) => w.name === name,
      )!;
      moveTo(index);
      selectWord(stops[index]!.key, found);
      return true;
    },
    /**
     * `{` / `}`: the next or previous blank line. The unchanged lines hidden
     * between hunks count as a gap too, so it stops on entering another hunk.
     */
    paragraph(step: 1 | -1) {
      let index = current;
      let seenText = false;
      const fromHunk = stop ? hunkOf(stop) : null;
      for (let i = current + step; i >= 0 && i < stops.length; i += step) {
        const line = lineOf(stops[i]!);
        if (!line) continue;
        index = i;
        if (fromHunk !== null && hunkOf(stops[i]!) !== fromHunk) break;
        const blank = line.line.text.trim() === '';
        if (!blank) seenText = true;
        if (blank && seenText) break;
      }
      moveTo(index);
    },
    /** The cursor line's first symbol, for acting before one is picked. */
    firstWord() {
      const first = here ? identifiers(here.line.text)[0] : undefined;
      return here && first ? { ...here, identifier: first } : null;
    },
    /** The new-side line number under the cursor, or `null` off code. */
    cursorLine: () => here?.line.newNo ?? null,
    /** Lands on `key` and picks the symbol called `name` there. */
    landOnWord(key: string, name: string) {
      pendingWord.current = { key, name };
      landOn(key);
    },
    stopAtRow: (row: number) => stopAtRow(stops, row),
  };

  function keepInView(target: Stop | undefined) {
    if (target) {
      const margin = target.target.kind === 'file' ? 1 : MARGIN;
      const room = clamp(Math.floor((height - target.height) / 2), 0, margin);
      if (target.row - room < top.current) {
        top.current = target.row - room;
      } else if (target.row + target.height + room > top.current + height) {
        top.current =
          target.height + 2 * room > height
            ? target.row - room
            : target.row + target.height + room - height;
      }
    }
    top.current = clamp(top.current, 0, rows.length - height);
  }

  /** The key is recorded at once, so a layout rebuilt in the same update keeps the move. */
  function moveTo(index: number) {
    const next = clamp(index, 0, stops.length - 1);
    cursorKey.current = stops[next]?.key ?? cursorKey.current;
    setCursor(next);
  }

  function page(direction: 1 | -1) {
    const half = Math.floor(height / 2);
    top.current += direction * half;
    moveTo(stopAtRow(stops, Math.max(0, (stop?.row ?? 0) + direction * half)));
  }

  /** Wheel scrolling: moves the viewport, dragging the cursor only if it falls out. */
  function scrollBy(delta: number) {
    top.current = clamp(top.current + delta, 0, rows.length - height);
    if (stop && (stop.row < top.current || stop.row >= top.current + height)) {
      const row =
        delta > 0 ? top.current + MARGIN : top.current + height - 1 - MARGIN;
      moveTo(stopAtRow(stops, row));
    } else {
      redraw();
    }
  }

  function jumpToFile(file: number) {
    const row = layout.fileRows[file];
    if (row === undefined) return;
    top.current = Math.max(0, row - (file > 0 ? 1 : 0));
    moveTo(stops.findIndex((candidate) => candidate.row === row));
  }

  function moveToHunk(step: 1 | -1) {
    if (!stop) return;
    const fromHunk = hunkOf(stop);
    let index = findStop(step, (candidate) => {
      const hunk = hunkOf(candidate);
      return hunk !== null && hunk !== fromHunk;
    });
    if (index === -1) return;
    if (step === -1) {
      const target = hunkOf(stops[index]!);
      while (index > 0 && hunkOf(stops[index - 1]!) === target) index -= 1;
    }
    moveTo(index);
  }

  function moveToComment(step: 1 | -1): boolean {
    const index = findStop(
      step,
      (candidate) => candidate.target.kind === 'comment',
    );
    if (index !== -1) moveTo(index);
    return index !== -1;
  }

  function findStop(step: 1 | -1, test: (stop: Stop) => boolean): number {
    for (let i = current + step; i >= 0 && i < stops.length; i += step) {
      if (test(stops[i]!)) return i;
    }
    return -1;
  }

  function toggleFold(file: FileDiff) {
    setFolds((map) => new Map(map).set(file.path, !collapsed.has(file.path)));
    pendingKey.current = stopKey.file(file.path);
  }

  /** Moves the cursor to the stop with `key`, now or once the layout has it. */
  function landOn(key: string) {
    const index = stops.findIndex((candidate) => candidate.key === key);
    if (index === -1) {
      pendingKey.current = key;
      return;
    }
    top.current = Math.max(0, stops[index]!.row - MARGIN);
    moveTo(index);
  }

  /** The line a stop shows on the cursor's side, with where it sits in the diff. */
  function lineOf(
    at: Stop,
  ): { line: DiffLine; hunk: number; index: number } | null {
    if (at.target.kind !== 'line') return null;
    const { hunk, left, right } = at.target;
    const index =
      view === 'split' && side === 'left' && left !== null
        ? left
        : (right ?? left);
    const line =
      index === null ? undefined : files[at.file]?.hunks[hunk]?.lines[index];
    return line && index !== null ? { line, hunk, index } : null;
  }

  /** Picks `identifier` on stop `key`'s line, scrolling sideways to show it. */
  function selectWord(key: string, identifier: Identifier) {
    setWord({ key, start: identifier.start });
    if (wrap) return;
    const room = layout.geometry.codeWidth;
    if (identifier.start < shiftX)
      setScrollX(Math.max(0, identifier.start - WORD_MARGIN));
    else if (identifier.end > shiftX + room)
      setScrollX(Math.min(maxScrollX, identifier.end - room + WORD_MARGIN));
  }

  function anchorAtCursor(): { anchor: Anchor; line: DiffLine | null } | null {
    if (!stop) return null;
    if (stop.target.kind === 'comment') {
      const { filePath, side: anchorSide, lineNumber } = stop.target.comment;
      return { anchor: { filePath, side: anchorSide, lineNumber }, line: null };
    }
    const file = files[stop.file];
    if (!file || stop.target.kind !== 'line') return null;
    const { left, right } = stop.target;
    const useLeft =
      view === 'split' &&
      ((side === 'left' && left !== null) || right === null);
    const index = useLeft ? left : (right ?? left);
    if (index === null) return null;
    const line = file.hunks[stop.target.hunk]!.lines[index]!;
    return {
      anchor: anchorFor(file, line, useLeft ? 'deletions' : 'additions'),
      line,
    };
  }

  function commentsAt(index: number, line: DiffLine): number {
    const counts = commentIndex.get(files[index]?.path ?? '');
    if (!counts) return 0;
    let total = 0;
    if (line.kind !== 'add' && line.oldNo !== null)
      total += counts.get(commentKey('deletions', line.oldNo)) ?? 0;
    if (line.kind !== 'del' && line.newNo !== null)
      total += counts.get(commentKey('additions', line.newNo)) ?? 0;
    return total;
  }

  function commentsIn(index: number): number {
    let total = 0;
    for (const count of commentIndex.get(files[index]?.path ?? '')?.values() ??
      [])
      total += count;
    return total;
  }
}

function longestLine(files: FileDiff[]): number {
  let longest = 0;
  for (const file of files)
    for (const hunk of file.hunks)
      for (const line of hunk.lines)
        longest = Math.max(longest, line.text.length);
  return longest;
}

function isFoldedByDefault(file: FileDiff): boolean {
  return (
    GENERATED.test(file.path) || file.additions + file.deletions > FOLD_LINES
  );
}

function hunkOf(stop: Stop): string | null {
  return stop.target.kind === 'line'
    ? `${stop.file}:${stop.target.hunk}`
    : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}
