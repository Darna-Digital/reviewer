import { describe, expect, test } from 'bun:test';
import { trackCommandKey } from './commandKey';

const LEFT_SUPER_DOWN = '\x1b[57444;9u';
const LEFT_SUPER_UP = '\x1b[57444;1:3u';

describe('trackCommandKey', () => {
  test('follows ⌘ down and up, swallowing both', () => {
    const key = trackCommandKey();
    expect(key.handle(LEFT_SUPER_DOWN)).toBe(true);
    expect(key.isHeld()).toBe(true);
    expect(key.handle(LEFT_SUPER_UP)).toBe(true);
    expect(key.isHeld()).toBe(false);
  });

  test('swallows other bare modifiers without losing ⌘', () => {
    const key = trackCommandKey();
    key.handle(LEFT_SUPER_DOWN);
    expect(key.handle('\x1b[57441;10u')).toBe(true);
    expect(key.isHeld()).toBe(true);
  });

  test('passes ordinary keys on, reading ⌘ from their modifiers', () => {
    const key = trackCommandKey();
    key.handle(LEFT_SUPER_DOWN);
    expect(key.handle('\x1b[106u')).toBe(false);
    expect(key.isHeld()).toBe(false);
    expect(key.handle('\x1b[101;9u')).toBe(false);
    expect(key.isHeld()).toBe(true);
  });

  test('ignores anything that is not a kitty key', () => {
    const key = trackCommandKey();
    expect(key.handle('\x1b[A')).toBe(false);
    expect(key.handle('j')).toBe(false);
  });

  test('forgets ⌘ when told the terminal lost focus', () => {
    const key = trackCommandKey();
    key.handle(LEFT_SUPER_DOWN);
    key.forget();
    expect(key.isHeld()).toBe(false);
  });
});
