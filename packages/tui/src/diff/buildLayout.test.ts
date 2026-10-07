import { describe, expect, test } from 'bun:test';
import type { ReviewComment } from '@reviewer/core/comments';
import { buildLayout, pairLines } from './buildLayout';
import type { LayoutOptions } from './buildLayout';
import { parseDiff } from './parseDiff';

const files = parseDiff(
  [
    'diff --git a/a.ts b/a.ts',
    '--- a/a.ts',
    '+++ b/a.ts',
    '@@ -1,3 +1,3 @@',
    ' keep',
    '-old',
    '+new',
    ' tail',
  ].join('\n'),
);

const base: LayoutOptions = {
  files,
  comments: [],
  width: 80,
  view: 'unified',
  wrap: true,
  collapsed: new Set(),
  showComments: true,
};

function comment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: 'c1',
    filePath: 'a.ts',
    side: 'additions',
    lineNumber: 2,
    body: 'looks off',
    author: 'me',
    createdAt: '2026-01-01T00:00:00.000Z',
    target: 'worktree',
    source: 'local',
    ...overrides,
  };
}

function kinds(opts: LayoutOptions) {
  return buildLayout(opts).rows.map((row) =>
    row.kind === 'comment' ? `comment:${row.part}` : row.kind,
  );
}

describe('buildLayout', () => {
  test('one stop per line plus the file header', () => {
    const layout = buildLayout(base);
    expect(kinds(base)).toEqual([
      'file',
      'hunk',
      'code',
      'code',
      'code',
      'code',
    ]);
    expect(layout.stops.map((s) => s.target.kind)).toEqual([
      'file',
      'line',
      'line',
      'line',
      'line',
    ]);
  });

  test('threads a card under the line it was left on', () => {
    const opts = { ...base, comments: [comment()] };
    expect(kinds(opts)).toEqual([
      'file',
      'hunk',
      'code',
      'code',
      'code',
      'comment:head',
      'comment:body',
      'comment:foot',
      'code',
    ]);
    expect(
      buildLayout(opts).stops.find((s) => s.target.kind === 'comment')?.height,
    ).toBe(3);
  });

  test('lists a comment whose line left the diff under the header', () => {
    const layout = buildLayout({
      ...base,
      comments: [comment({ lineNumber: 99 })],
    });
    expect(layout.rows[1]).toMatchObject({ kind: 'comment', outdated: true });
  });

  test('a wrapped line stays one stop', () => {
    const long = parseDiff(
      [
        'diff --git a/a b/a',
        '--- a/a',
        '+++ b/a',
        '@@ -0,0 +1 @@',
        `+${'x'.repeat(150)}`,
      ].join('\n'),
    );
    const layout = buildLayout({ ...base, files: long });
    const code = layout.rows.filter((row) => row.kind === 'code');
    expect(code.length).toBeGreaterThan(1);
    expect(layout.stops.at(-1)?.height).toBe(code.length);
  });

  test('a collapsed file keeps only its header', () => {
    expect(kinds({ ...base, collapsed: new Set(['a.ts']) })).toEqual(['file']);
  });
});

describe('pairLines', () => {
  test('sets removals beside the additions that replace them', () => {
    expect(pairLines(files[0]!.hunks[0]!.lines)).toEqual([
      [0, 0],
      [1, 2],
      [3, 3],
    ]);
  });
});
