import { describe, expect, test } from 'bun:test';
import { popoverPlacement } from './popoverPlacement';
import type { PlacementInput } from './popoverPlacement';

const base: PlacementInput = {
  stop: { row: 10, height: 1, file: 0, key: 'L', target: { kind: 'file' } },
  paneTop: 2,
  scrollTop: 0,
  paneLeft: 30,
  paneWidth: 120,
  geometry: { numberWidth: 3, gutter: 10, codeWidth: 110, half: 60 },
  view: 'unified',
  side: 'additions',
  height: 8,
  screen: { top: 1, bottom: 49 },
  over: false,
};

describe('popoverPlacement', () => {
  test('opens under the line, lined up with the code', () => {
    expect(popoverPlacement(base)).toEqual({ left: 40, top: 13, width: 96 });
  });

  test('flips above the line near the bottom', () => {
    const near = { ...base, stop: { ...base.stop, row: 44 } };
    expect(popoverPlacement(near).top).toBe(46 - 8);
  });

  test('takes the new side of a split diff', () => {
    const split = popoverPlacement({ ...base, view: 'split' });
    expect(split.left).toBe(30 + 61 + 10);
    expect(split.width).toBe(49);
  });

  test('sits on the card when editing', () => {
    expect(popoverPlacement({ ...base, over: true }).top).toBe(12);
  });
});
