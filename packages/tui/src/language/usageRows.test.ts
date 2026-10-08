import { describe, expect, test } from 'bun:test';
import type { ReferenceKind, ReferencesResult } from './client';
import { usageRows } from './usageRows';

const at = (path: string, line: number, kind: ReferenceKind) => ({
  location: {
    path,
    range: {
      start: { line, character: 0 },
      end: { line, character: 3 },
    },
  },
  kind,
  preview: 'foo()',
  containerName: '',
  containerKind: '',
});

describe('usageRows', () => {
  test('groups by category then file, declaration first', () => {
    const result: ReferencesResult = {
      providerId: 'typescript',
      origin: null,
      symbol: 'foo',
      declaration: {
        location: at('a.ts', 1, 'definition').location,
        name: 'foo',
        kind: 'function',
        containerName: '',
        preview: '',
      },
      references: [
        at('b.ts', 4, 'read'),
        at('a.ts', 1, 'definition'),
        at('b.ts', 9, 'read'),
        at('c.ts', 2, 'import'),
      ],
    };
    expect(
      usageRows(result).map((row) =>
        row.kind === 'usage'
          ? `  ${row.reference.location.range.start.line}`
          : row.kind === 'file'
            ? ` ${row.path} ${row.count}`
            : `${row.label} ${row.count}`,
      ),
    ).toEqual([
      'Function 1',
      ' a.ts 1',
      '  1',
      'Usages 2',
      ' b.ts 2',
      '  4',
      '  9',
      'Usage in import 1',
      ' c.ts 1',
      '  2',
    ]);
  });
});
