import { describe, expect, test } from 'bun:test';
import { cellWidth, truncateMiddle, wrapCells } from './measure';

describe('truncateMiddle', () => {
  test('leaves a name that fits alone', () => {
    expect(truncateMiddle('main', 4)).toBe('main');
  });

  test('keeps both ends around the ellipsis', () => {
    expect(truncateMiddle('feature/checkout-redesign', 12)).toBe(
      'featur…esign',
    );
  });

  test('gives the start the odd cell', () => {
    expect(truncateMiddle('abcdefghij', 6)).toBe('abc…ij');
  });

  test('never runs wider than asked with wide characters', () => {
    const cut = truncateMiddle('分支名称很长很长的分支', 9);
    expect(cut).toContain('…');
    expect(cellWidth(cut)).toBeLessThanOrEqual(9);
  });

  test('is only an ellipsis at one cell, and nothing at none', () => {
    expect(truncateMiddle('feature/x', 1)).toBe('…');
    expect(truncateMiddle('feature/x', 0)).toBe('');
  });
});

describe('wrapCells', () => {
  test('breaks into rows of the width', () => {
    expect(wrapCells('abcdefgh', 3)).toEqual(['abc', 'def', 'gh']);
  });

  test('keeps a short text on one row', () => {
    expect(wrapCells('main', 10)).toEqual(['main']);
  });
});
