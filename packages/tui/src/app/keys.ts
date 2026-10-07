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

/** Shifted symbols some terminals report in place of the key pressed. */
const UNSHIFTED: Record<string, string> = {
  '}': ']',
  '{': '[',
  '<': ',',
  '>': '.',
  '?': '/',
  '!': '1',
  '@': '2',
  '#': '3',
  $: '4',
  '%': '5',
  '^': '6',
  '&': '7',
};

const MOD_ORDER = ['ctrl', 'alt', 'shift', 'cmd'] as const;
const MOD_GLYPH: Record<string, string> = {
  ctrl: '⌃',
  alt: '⌥',
  shift: '⇧',
  cmd: '⌘',
};
const KEY_GLYPH: Record<string, string> = {
  return: '⏎',
  escape: 'esc',
  backspace: '⌫',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  pageup: 'pgup',
  pagedown: 'pgdn',
};

/**
 * A key as the command table spells it: `ctrl+d`, `cmd+shift+f`,
 * `alt+cmd+1`, `shift+tab`, `down`, or the printed character itself (`G`,
 * `?`, `]`) so shifted symbols need no table. `cmd` is ⌘, which arrives only
 * from terminals that speak the kitty keyboard protocol and leave ⌘ alone.
 */
export function keyName(key: KeyEvent): string {
  const mods = [
    key.ctrl && 'ctrl',
    (key.meta || key.option) && 'alt',
    key.super && 'cmd',
  ].filter(Boolean);
  if (mods.length === 0) {
    if (NAMED.has(key.name)) return key.shift ? `shift+${key.name}` : key.name;
    if (key.sequence.length === 1) return key.sequence;
    return key.name;
  }
  const name = key.name.length === 1 ? key.name.toLowerCase() : key.name;
  return [...mods, key.shift && 'shift', UNSHIFTED[name] ?? name]
    .filter(Boolean)
    .join('+');
}

/** How a key reads in help and hints, modifiers in the Mac's order: ⌃⌥⇧⌘. */
export function keyLabel(name: string): string {
  if (name === '+' || !name.includes('+')) return KEY_GLYPH[name] ?? name;
  const parts = name.split('+');
  const key = parts.pop()!;
  const mods = MOD_ORDER.filter((mod) => parts.includes(mod))
    .map((mod) => MOD_GLYPH[mod])
    .join('');
  return (
    mods + (KEY_GLYPH[key] ?? (key.length === 1 ? key.toUpperCase() : key))
  );
}
