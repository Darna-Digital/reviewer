import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/** The checkout `build:bin` compiled the binary from. */
declare const REVIEWER_CHECKOUT: string | undefined;

export const SERVER_PORT = Number(process.env['REVIEWER_PORT'] || 41811);
export const SERVER_LOG = join(homedir(), '.reviewer', 'server.log');

const PROBE_TIMEOUT_MS = 1000;
const POLL_MS = 300;
const START_TIMEOUT_MS = 30_000;
const EXITED_GRACE_MS = 3000;
const APP_LOCATIONS = [
  '/Applications/Reviewer.app',
  join(homedir(), 'Applications', 'Reviewer.app'),
];

export interface Launch {
  /** Run through a login shell, so git, gh and the agents resolve as in a terminal. */
  command: string;
  cwd: string;
  /** Where it was found, for the notice. */
  from: string;
}

export type ServerOutcome =
  | { kind: 'running' }
  | { kind: 'started'; from: string }
  | { kind: 'failed'; reason: string };

/** The Mac app's liveness probe: any answer from `/api/workspace` means up. */
export async function isServerUp(port = SERVER_PORT): Promise<boolean> {
  try {
    await fetch(`http://127.0.0.1:${port}/api/workspace`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * How to start the server: from a Reviewer checkout (this one in
 * development, or the one the binary was built from), else from the
 * installed Reviewer.app's bundled Node.
 */
export function findLaunch(env = process.env): Launch | null {
  const checkout = [
    env['REVIEWER_REPO_ROOT'],
    typeof REVIEWER_CHECKOUT === 'string' ? REVIEWER_CHECKOUT : undefined,
    workspaceAbove(import.meta.dir),
  ].find((root) => root && isCheckout(root));
  if (checkout) {
    return {
      command: 'exec pnpm --filter @reviewer/embedded-server start',
      cwd: checkout,
      from: checkout,
    };
  }
  const app = APP_LOCATIONS.find((path) =>
    existsSync(join(path, 'Contents/Resources/server/main.cjs')),
  );
  if (app) {
    const node = shellQuote(join(app, 'Contents/MacOS/node'));
    const main = shellQuote(join(app, 'Contents/Resources/server/main.cjs'));
    return { command: `exec ${node} ${main}`, cwd: homedir(), from: app };
  }
  return null;
}

/**
 * Starts the server unless one already answers. It is started detached and
 * left running: it is shared with the Mac app, which reuses any server it
 * finds and stops only the ones it started.
 */
export async function ensureServer(repo: string): Promise<ServerOutcome> {
  if (await isServerUp()) return { kind: 'running' };
  const launch = findLaunch();
  if (!launch)
    return {
      kind: 'failed',
      reason: 'no Reviewer checkout or Reviewer.app to start it from',
    };

  mkdirSync(dirname(SERVER_LOG), { recursive: true });
  const log = openSync(SERVER_LOG, 'a');
  let exited = false;
  let deadline = Date.now() + START_TIMEOUT_MS;
  const child = spawn(loginShell(), ['-lc', launch.command], {
    cwd: launch.cwd,
    env: {
      ...process.env,
      REVIEWER_PORT: String(SERVER_PORT),
      REVIEWER_REPO: repo,
    },
    detached: true,
    stdio: ['ignore', log, log],
  });
  // poll the port, not the child: when the Mac app starts one at the same
  // moment, ours loses the port and exits while theirs comes up
  const giveUpSoon = () => {
    exited = true;
    deadline = Math.min(deadline, Date.now() + EXITED_GRACE_MS);
  };
  child.on('exit', giveUpSoon);
  child.on('error', giveUpSoon);
  child.unref();

  while (Date.now() < deadline) {
    await Bun.sleep(POLL_MS);
    if (await isServerUp()) return { kind: 'started', from: launch.from };
  }
  const why = exited ? 'it exited' : 'it did not answer';
  return { kind: 'failed', reason: `${why} — see ${SERVER_LOG}` };
}

function workspaceAbove(dir: string): string | undefined {
  for (let at = dir; at !== dirname(at); at = dirname(at)) {
    if (existsSync(join(at, 'pnpm-workspace.yaml'))) return at;
  }
  return undefined;
}

function isCheckout(root: string): boolean {
  return existsSync(join(root, 'packages/embedded-server/src/main.ts'));
}

function loginShell(): string {
  if (process.platform === 'darwin') return '/bin/zsh';
  return process.env['SHELL'] || '/bin/sh';
}

function shellQuote(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`;
}
