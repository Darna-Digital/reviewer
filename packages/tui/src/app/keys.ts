import type { KeyEvent } from '@opentui/core';

const NAMED = new Set([
  'return',
  'escape',
  'tab',
  'up',
  'down',
  'left',
  'right',
  'pageup',
  'pagedown',
  'home',
  'end',
  'space',
  'backspace',
]);

/**
 * A key as the command table spells it: `ctrl+d`, `shift+tab`, `down`, or the
 * printed character itself (`G`, `?`, `]`) so shifted symbols need no table.
 */
export function keyName(key: KeyEvent): string {
  if (key.ctrl) return `ctrl+${key.name}`;
  if (key.meta) return `alt+${key.name}`;
  if (NAMED.has(key.name)) return key.shift ? `shift+${key.name}` : key.name;
  if (key.sequence.length === 1) return key.sequence;
  return key.name;
}

/** How a key reads in help and hints. */
export function keyLabel(name: string): string {
  return name
    .replace('ctrl+', '^')
    .replace('alt+', '⌥')
    .replace('return', '⏎')
    .replace('escape', 'esc')
    .replace('up', '↑')
    .replace('down', '↓')
    .replace('left', '←')
    .replace('right', '→');
}
