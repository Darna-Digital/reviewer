import { describe, expect, test } from 'bun:test';
import { buildTree, filterTree, flattenTree } from './fileTree';

const tree = buildTree([
  { path: 'README.md' },
  { path: 'packages/tui/src/main.tsx', status: 'modified' },
  { path: 'packages/tui/src/app/App.tsx' },
  { path: 'packages/core/index.ts' },
  { path: 'file10.ts' },
  { path: 'file2.ts' },
]);

describe('buildTree', () => {
  test('folders first, numeric order, single-child chains folded', () => {
    const rows = flattenTree(tree, () => true).map(
      (row) => `${'  '.repeat(row.depth)}${row.node.name}`,
    );
    expect(rows).toEqual([
      'packages',
      '  core',
      '    index.ts',
      '  tui/src',
      '    app',
      '      App.tsx',
      '    main.tsx',
      'file2.ts',
      'file10.ts',
      'README.md',
    ]);
  });

  test('marks folders holding changes', () => {
    expect(tree[0]?.changed).toBe(true);
    expect(tree[0]?.children[0]?.changed).toBe(false);
  });

  test('filters to matching files and their folders', () => {
    const rows = flattenTree(filterTree(tree, 'app'), () => true).map(
      (row) => row.node.name,
    );
    expect(rows).toEqual(['packages', 'tui/src', 'app', 'App.tsx']);
  });
});
