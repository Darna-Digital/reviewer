import { highlightCode, loadTheme } from '@reviewer/core/themes';
import type { CodeToken } from '@reviewer/core/themes';

declare const self: Worker;

export interface HighlightRequest {
  id: number;
  text: string;
  language: string;
  themeName: string;
}

export interface HighlightReply {
  id: number;
  lines: CodeToken[][];
}

/** Tokenizes off the UI thread: a large file costs the grammar time, not a frozen frame. */
self.onmessage = async (event: MessageEvent<HighlightRequest>) => {
  const { id, text, language, themeName } = event.data;
  let lines: CodeToken[][] = [];
  try {
    const theme = await loadTheme(themeName);
    if (theme) {
      const result = await highlightCode(text, language, theme);
      lines = result.lines.map((line) => [...line]);
    }
  } catch {
    // left plain
  }
  self.postMessage({ id, lines } satisfies HighlightReply);
};
