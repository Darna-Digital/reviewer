import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

/** Stamped in by `release/package.sh`. */
declare const REVIEWER_VERSION: string | undefined;

export const VERSION =
  typeof REVIEWER_VERSION === 'string' ? REVIEWER_VERSION : 'dev';

export const INSTALL_URL = 'https://reviewer.sh/install';
const RELEASES = 'https://github.com/Darna-Digital/reviewer/releases';
const MANIFEST = 'install-manifest.txt';
const CHECK_TIMEOUT_MS = 3000;

/**
 * Where the one-line install put this binary: `<home>/releases/<version>/`,
 * with the server it starts beside it. `null` for any other build.
 */
export function installedRelease(): { home: string; dir: string } | null {
  const dir = dirname(realpathSync(process.execPath));
  const releases = dirname(dir);
  if (basename(releases) !== 'releases') return null;
  return { home: dirname(releases), dir };
}

/** The server installed with this release, when there is one: Node.js linked in, and its bundle. */
export function installedServer(): { node: string; main: string } | null {
  const release = installedRelease();
  if (!release) return null;
  const node = join(release.dir, 'server', 'node');
  const main = join(release.dir, 'server', 'main.cjs');
  return existsSync(node) && existsSync(main) ? { node, main } : null;
}

/** Re-runs the installer over this install: the latest release, or `version`. */
export function upgrade(version?: string): number {
  const release = installedRelease();
  if (!release) {
    console.error(
      `reviewer: this build was not installed with the one-line installer — install one with\n  curl -fsSL ${INSTALL_URL} | bash`,
    );
    return 1;
  }
  const args = version ? ` -s -- --version ${quote(version)}` : '';
  const result = spawnSync(
    'sh',
    ['-c', `curl -fsSL ${INSTALL_URL} | sh${args}`],
    {
      stdio: 'inherit',
      env: { ...process.env, REVIEWER_HOME: release.home },
    },
  );
  return result.status ?? 1;
}

/** The latest release's version, when it is newer than this one. */
export async function newerRelease(): Promise<string | null> {
  if (!installedRelease()) return null;
  try {
    const response = await fetch(`${RELEASES}/latest/download/${MANIFEST}`, {
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const latest = /^version (\S+)$/m.exec(await response.text())?.[1];
    return latest && isNewer(latest, VERSION) ? latest : null;
  } catch {
    return null;
  }
}

/** Plain `X.Y.Z` versions, compared part by part. */
export function isNewer(candidate: string, current: string): boolean {
  const a = candidate.split('.').map(Number);
  const b = current.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (Number.isNaN(diff)) return false;
    if (diff !== 0) return diff > 0;
  }
  return false;
}

function quote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}
