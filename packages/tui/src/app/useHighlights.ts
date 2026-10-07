import * as React from 'react';
import type { Row } from '../diff/buildLayout';
import { highlightFile } from '../diff/highlight';
import type { FileTokens, Theme } from '../diff/highlight';
import type { FileDiff } from '../diff/parseDiff';

interface HighlightOptions {
  files: FileDiff[];
  rows: Row[];
  /** First row in view. */
  top: number;
  height: number;
  collapsed: ReadonlySet<string>;
  theme: Theme;
  themeName: string;
}

/**
 * Syntax tokens for the files in and around the viewport, fetched lazily;
 * the pane redraws as each file's tokens land.
 */
export function useHighlights(opts: HighlightOptions) {
  const { files, rows, top, height, collapsed, theme, themeName } = opts;
  const tokens = React.useRef(new WeakMap<FileDiff, FileTokens>());
  const pending = React.useRef(new WeakSet<FileDiff>());
  const [, redraw] = React.useReducer((n: number) => n + 1, 0);

  React.useEffect(() => {
    const wanted = new Set<number>();
    const end = Math.min(rows.length, top + height * 2);
    for (let r = Math.max(0, top - height); r < end; r += 1) {
      const row = rows[r]!;
      if ('file' in row) wanted.add(row.file);
    }
    for (const index of wanted) {
      const file = files[index];
      if (!file || collapsed.has(file.path)) continue;
      if (tokens.current.has(file) || pending.current.has(file)) continue;
      pending.current.add(file);
      void highlightFile(file, theme, themeName).then((result) => {
        tokens.current.set(file, result);
        redraw();
      });
    }
  });

  return React.useCallback(
    (index: number) => {
      const file = files[index];
      return file ? tokens.current.get(file) : undefined;
    },
    [files],
  );
}
