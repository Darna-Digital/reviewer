import { describe, expect, test } from 'bun:test';
import { changedSpans } from './inlineChanges';

describe('changedSpans', () => {
  test('marks the changed word, snapped to word edges', () => {
    expect(changedSpans('const fooBar = 1;', 'const fooBaz = 1;')).toEqual({
      del: { start: 6, end: 12 },
      add: { start: 6, end: 12 },
    });
  });

  test('skips lines that were rewritten', () => {
    expect(changedSpans('alpha beta', 'gamma delta')).toBeNull();
  });
});
