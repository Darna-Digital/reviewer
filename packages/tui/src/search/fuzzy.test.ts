import { describe, expect, test } from 'bun:test';
import { fuzzyFilter, fuzzyScore, matchRange } from './fuzzy';

const plain = { caseSensitive: false, wholeWord: false, regex: false };

describe('fuzzyScore', () => {
  test('prefers early, tight matches', () => {
    expect(fuzzyScore('src/app/App.tsx', 'app')).toBe(5);
    expect(fuzzyScore('abc', 'xyz')).toBeNull();
    expect(fuzzyScore('anything', '')).toBe(0);
  });

  test('ranks the tighter path first', () => {
    const paths = ['src/a/p/p.ts', 'src/app.ts'];
    expect(fuzzyFilter(paths, 'app', (p) => p)).toEqual([
      'src/app.ts',
      'src/a/p/p.ts',
    ]);
  });
});

describe('matchRange', () => {
  test('finds fixed strings case-insensitively', () => {
    expect(matchRange('const Foo = 1', 'foo', plain)).toEqual([6, 9]);
  });

  test('honours case, word and regex', () => {
    const text = 'foobar foo';
    expect(matchRange(text, 'foo', { ...plain, wholeWord: true })).toEqual([
      7, 10,
    ]);
    expect(matchRange('Foo', 'foo', { ...plain, caseSensitive: true })).toBe(
      null,
    );
    expect(matchRange('a1b22', '\\d+', { ...plain, regex: true })).toEqual([
      1, 2,
    ]);
    expect(matchRange('x', '(', { ...plain, regex: true })).toBeNull();
  });
});
