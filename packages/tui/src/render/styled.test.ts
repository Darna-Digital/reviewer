import { describe, expect, test } from 'bun:test';
import { sliceSegs } from './styled';

const text = (segs: Array<{ text: string }>) =>
  segs.map((s) => s.text).join('');

describe('sliceSegs', () => {
  test('drops the scrolled-off cells, marks a cut and pads to width', () => {
    const segs = [{ text: 'abc' }, { text: 'defg', fg: '#fff' }];
    expect(text(sliceSegs(segs, 0, 5))).toBe('abcd…');
    expect(text(sliceSegs(segs, 2, 4))).toBe('cde…');
    expect(sliceSegs(segs, 4, 3)[0]).toEqual({ text: 'efg', fg: '#fff' });
    expect(text(sliceSegs(segs, 5, 4))).toBe('fg  ');
  });
});
