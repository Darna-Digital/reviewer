/** Kitty's codes for a modifier key pressed on its own, ⇧ through ISO level 5. */
const FIRST_MODIFIER = 57441;
const LAST_MODIFIER = 57454;
const SUPER_KEYS = new Set([57444, 57450]);
const SUPER_BIT = 8;
const RELEASE = '3';
const KITTY_KEY = /^\[(\d+)(?::\d*)*(?:;(\d+)(?::(\d+))?)?(?:;[\d:]*)?u$/;
const ESC = '\x1b';

export type CommandKey = ReturnType<typeof trackCommandKey>;

/**
 * Whether ⌘ is down. Mouse reports carry no ⌘, so ⌘-click reads it off the
 * kitty protocol's events for the key itself; those, and every other bare
 * modifier, are swallowed so the rest of the app never sees them.
 */
export function trackCommandKey() {
  let held = false;
  return {
    isHeld: () => held,
    /** ⌘'s release goes unseen when the terminal loses focus mid-press. */
    forget: () => {
      held = false;
    },
    /** An input handler: true when the sequence was a bare modifier. */
    handle(sequence: string): boolean {
      const match = sequence.startsWith(ESC)
        ? KITTY_KEY.exec(sequence.slice(1))
        : null;
      if (!match) return false;
      const code = Number(match[1]);
      const mods = Number(match[2] ?? 1) - 1;
      held = SUPER_KEYS.has(code)
        ? match[3] !== RELEASE
        : (mods & SUPER_BIT) !== 0;
      return code >= FIRST_MODIFIER && code <= LAST_MODIFIER;
    },
  };
}
