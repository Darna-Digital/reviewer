import { describe, expect, test } from 'bun:test';
import { identifierAt, identifiers } from './identifier';

describe('identifierAt', () => {
  const line = 'const total = items.reduce(sum, 0x1f);';

  test('finds the word under the column', () => {
    expect(identifierAt(line, 8)).toEqual({ name: 'total', start: 6, end: 11 });
    expect(identifierAt(line, 20)?.name).toBe('reduce');
    expect(identifierAt(line, 5)).toBeNull();
    expect(identifierAt(line, 2)).toBeNull();
  });

  test('skips keywords and number tails, keeps $ and _', () => {
    expect(identifiers(line).map((w) => w.name)).toEqual([
      'total',
      'items',
      'reduce',
      'sum',
    ]);
    expect(identifierAt('$el._x', 2)?.name).toBe('$el');
  });
});
