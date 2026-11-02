import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const HOME = homedir();

/** `~/code/app` as the absolute path it stands for. */
export function expandHome(path: string): string {
  const trimmed = path.trim();
  if (trimmed === '~') return HOME;
  if (trimmed.startsWith('~/')) return join(HOME, trimmed.slice(2));
  return resolve(trimmed);
}

/** An absolute path with the home folder folded back to `~`. */
export function foldHome(path: string): string {
  if (path === HOME) return '~';
  return path.startsWith(`${HOME}/`) ? `~${path.slice(HOME.length)}` : path;
}

/** Whether typed text reads as a path rather than a search. */
export function looksLikePath(text: string): boolean {
  return /^(~|\/|\.{1,2}(\/|$))/.test(text.trim());
}
