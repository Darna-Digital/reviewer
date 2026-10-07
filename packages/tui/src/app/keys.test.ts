import type { KeyEvent } from '@opentui/core';
import { describe, expect, test } from 'bun:test';
import { keyLabel, keyName } from './keys';

const key = (patch: Partial<KeyEvent>) =>
  ({
    name: '',
    sequence: '',
    ctrl: false,
    meta: false,
    shift: false,
    option: false,
    ...patch,
  }) as KeyEvent;

describe('keyName', () => {
  test('spells ⌘ chords from the kitty protocol', () => {
    expect(keyName(key({ name: 'k', super: true }))).toBe('cmd+k');
    expect(keyName(key({ name: 'f', super: true, shift: true }))).toBe(
      'cmd+shift+f',
    );
    expect(keyName(key({ name: '1', super: true, meta: true }))).toBe(
      'alt+cmd+1',
    );
    expect(keyName(key({ name: '}', super: true, shift: true }))).toBe(
      'cmd+shift+]',
    );
  });

  test('keeps plain keys as typed', () => {
    expect(keyName(key({ name: 'g', sequence: 'G', shift: true }))).toBe('G');
    expect(keyName(key({ name: 'tab', shift: true }))).toBe('shift+tab');
    expect(keyName(key({ name: 'd', ctrl: true }))).toBe('ctrl+d');
  });
});

describe('keyLabel', () => {
  test('orders modifiers as the Mac does', () => {
    expect(keyLabel('cmd+shift+o')).toBe('⇧⌘O');
    expect(keyLabel('alt+cmd+1')).toBe('⌥⌘1');
    expect(keyLabel('ctrl+cmd+s')).toBe('⌃⌘S');
    expect(keyLabel('cmd+return')).toBe('⌘⏎');
    expect(keyLabel('shift+tab')).toBe('⇧tab');
    expect(keyLabel('+')).toBe('+');
    expect(keyLabel('escape')).toBe('esc');
  });
});
