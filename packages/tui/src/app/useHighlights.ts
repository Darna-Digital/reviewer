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
  const store = React.useRef(emptyStore(themeName));
  if (store.current.themeName !== themeName)
    store.current = emptyStore(themeName);
  const { tokens, pending } = store.current;
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
      if (tokens.has(file) || pending.has(file)) continue;
      pending.add(file);
      void highlightFile(file, theme, themeName).then((result) => {
        tokens.set(file, result);
        redraw();
      });
    }
  });

  return React.useCallback(
    (index: number) => {
      const file = files[index];
      return file ? tokens.get(file) : undefined;
    },
    [files, tokens],
  );
}

/** Tokens belong to the theme they were coloured in; a new theme starts over. */
function emptyStore(themeName: string) {
  return {
    themeName,
    tokens: new WeakMap<FileDiff, FileTokens>(),
    pending: new WeakSet<FileDiff>(),
  };
}
