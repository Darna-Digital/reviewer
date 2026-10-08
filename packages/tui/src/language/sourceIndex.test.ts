import { describe, expect, test } from 'bun:test';
import { sourceIndex } from './sourceIndex';

describe('sourceIndex', () => {
  test('is the shown index when nothing was expanded', () => {
    expect(sourceIndex('const a = 1', 6)).toBe(6);
  });

  test('undoes tab expansion', () => {
    // "\t\tfoo" is shown as 8 spaces then foo
    expect(sourceIndex('\t\tfoo', 8)).toBe(2);
    expect(sourceIndex('a\tb', 4)).toBe(2);
  });
});
