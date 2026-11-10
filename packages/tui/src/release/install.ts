import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { claimUsageDay } from './usage';

/** Stamped in by `release/package.sh`. */
declare const REVIEWER_VERSION: string | undefined;

export const VERSION =
  typeof REVIEWER_VERSION === 'string' ? REVIEWER_VERSION : 'dev';

export const INSTALL_URL = 'https://reviewer.sh/install';
/** The latest release's install-manifest.txt, by way of reviewer.sh. */
const UPDATE_CHECK = 'https://reviewer.sh/install-manifest.txt';
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
  const result = spawnSync(
    'sh',
    installer(version ? ['--version', version] : []),
    {
      stdio: 'inherit',
      env: { ...process.env, REVIEWER_HOME: release.home },
    },
  );
  return result.status ?? 1;
}

/**
 * Installs `version` over this install without a terminal, as the palette's
 * update does; the shell's PATH line is left as it is. Fails with the
 * installer's own last word.
 */
export async function installRelease(version: string): Promise<void> {
  const release = installedRelease();
  if (!release)
    throw new Error('This build was not installed with the one-line installer');
  const proc = Bun.spawn(
    ['sh', ...installer(['--version', version, '--no-modify-path'])],
    {
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'pipe',
      env: { ...process.env, REVIEWER_HOME: release.home },
    },
  );
  const [stderr, code] = await Promise.all([
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  // `curl … | sh` exits 0 when curl fails and sh reads nothing: the link says what was installed
  if (code !== 0 || linkedVersion(release.home) !== version) {
    const said = stderr
      .trim()
      .split('\n')
      .pop()
      ?.replace(/^reviewer: /, '');
    throw new Error(said || `Reviewer ${version} could not be installed`);
  }
}

/** The binary the install runs now: `bin/reviewer`, after an update the newer release. */
export function linkedBinary(home: string): string {
  return join(home, 'bin', 'reviewer');
}

function linkedVersion(home: string): string | null {
  try {
    return basename(dirname(realpathSync(linkedBinary(home))));
  } catch {
    return null;
  }
}

function installer(args: string[]): string[] {
  const passed = args.length > 0 ? ` -s -- ${args.map(quote).join(' ')}` : '';
  return ['-c', `curl -fsSL ${INSTALL_URL} | sh${passed}`];
}

/** The latest release's version, when it is newer than this one. */
export async function newerRelease(count: boolean): Promise<string | null> {
  if (!installedRelease()) return null;
  try {
    const latest = await latestRelease(count);
    return isNewer(latest, VERSION) ? latest : null;
  } catch {
    return null;
  }
}

/**
 * The latest release's version, as its manifest gives it — asked of
 * reviewer.sh, which redirects to the latest release's copy. With `count`,
 * the day's first check also carries the usage flags (see usage.ts).
 */
export async function latestRelease(count: boolean): Promise<string> {
  const home = installedRelease()?.home;
  const claim = count && home && VERSION !== 'dev' ? claimUsageDay(home) : null;
  let response: Response;
  try {
    response = await fetch(`${UPDATE_CHECK}${claim ? `?${claim.query}` : ''}`, {
      headers: { 'User-Agent': `reviewer-tui/${VERSION}` },
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
  } catch (error) {
    claim?.release();
    throw error;
  }
  if (!response.ok) {
    claim?.release();
    throw new Error(
      `The update check answered ${response.status} for the latest release`,
    );
  }
  claim?.commit();
  const latest = /^version (\S+)$/m.exec(await response.text())?.[1];
  if (!latest) throw new Error("The latest release's manifest is unreadable");
  return latest;
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
