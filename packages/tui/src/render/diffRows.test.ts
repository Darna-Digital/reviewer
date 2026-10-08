import { describe, expect, test } from 'bun:test';
import type { ReviewComment } from '@reviewer/core/comments';
import { deriveChromeTokens } from '@reviewer/core/themes';
import { fileAsDiff } from '../app/useEditor';
import { buildLayout } from '../diff/buildLayout';
import type { ViewMode } from '../diff/buildLayout';
import { paintRow } from './diffRows';
import { createPalette } from './palette';

const files = [
  fileAsDiff('a.ts', { text: 'one\ntwo\nthree\n', binary: false }),
];
const note: ReviewComment = {
  id: 'c1',
  filePath: 'a.ts',
  side: 'additions',
  lineNumber: 2,
  body: 'is this right',
  author: 'me',
  createdAt: '2026-01-01T00:00:00.000Z',
  target: 'worktree',
  source: 'local',
};

function paintedCard(view: ViewMode, width: number): string {
  const layout = buildLayout({
    files,
    comments: [note],
    width,
    view,
    wrap: true,
    collapsed: new Set(),
    showComments: true,
  });
  const body = layout.rows.find(
    (row) => row.kind === 'comment' && row.part === 'body',
  )!;
  const segs = paintRow(
    {
      palette: createPalette(deriveChromeTokens({ type: 'dark' })),
      files,
      geometry: layout.geometry,
      width,
      view,
      collapsed: new Set(),
      focused: true,
      cursorSide: 'right',
      scrollX: 0,
      now: Date.now(),
      tokensOf: () => undefined,
      inlineOf: () => new Map(),
      commentsAt: () => 0,
      commentsIn: () => 1,
    },
    body,
    false,
  );
  return segs.map((seg) => seg.text).join('');
}

describe('comment cards', () => {
  test('show in the browse viewer, under the line', () => {
    const text = paintedCard('file', 100);
    expect(text).toContain('is this right');
    expect(text.indexOf('│')).toBeLessThan(10);
  });
});
