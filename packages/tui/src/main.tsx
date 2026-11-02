#!/usr/bin/env bun
import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { describeThemes, findTheme } from '@reviewer/themes';
import { Shell } from './app/Shell';
import { trackCommandKey } from './app/commandKey';
import { WORKTREE } from './app/comparison';
import type { Comparison } from './app/comparison';
import { parseCli, USAGE } from './cli';
import { upgrade, VERSION } from './release/install';
import type { CliOptions } from './cli';
import { git, resolves } from './git/exec';
import { repoInfo, repoRoot } from './git/repo';
import { readTerminalLook } from './app/useTheme';
import { stopAllSessions } from './process/ptySession';
import { loadSettings, TERMINAL_THEME } from './store/settings';
import { resolveLook } from './theme/resolveLook';
import { readSystemScheme } from './theme/systemAppearance';
import { openStore } from './store/createStore';
import { loadUiState } from './store/uiState';
import { reposOf } from './repos/repos';
import { ensureServer } from './process/reviewerServer';
import { workspaces } from './workspace/client';
import { folderWorkspace } from './workspace/folder';
import type { SavedWorkspace } from './workspace/client';
import type { Repos } from './repos/repos';
import type { Store } from './store/createStore';

const SHIFT_TO_APP = '\x1b[>1s';
const SHIFT_TO_TERMINAL = '\x1b[>0s';

await main(parseCli(Bun.argv.slice(2)));

async function main(cli: CliOptions) {
  if (cli.help) return exit(USAGE);
  if (cli.version) return exit(VERSION);
  if (cli.upgrade !== undefined)
    process.exit(upgrade(cli.upgrade || undefined));
  if (cli.listThemes) {
    return exit(
      describeThemes()
        .map(
          (t) =>
            `${t.name.padEnd(28)} ${t.colorScheme.padEnd(6)} ${t.displayName}`,
        )
        .join('\n'),
    );
  }
  if (
    cli.themeName &&
    cli.themeName !== TERMINAL_THEME &&
    !findTheme(cli.themeName)
  ) {
    fail(`no theme named "${cli.themeName}" — see --themes`);
  }

  const store = openStore();
  if (cli.listWorkspaces) {
    const saved = await savedWorkspaces(cli);
    return exit(
      saved
        .map((one) => `${one.name.padEnd(28)} ${one.roots.join('  ')}`)
        .join('\n') || 'No saved workspaces — open several paths, then ⌘O',
    );
  }
  const { repos, launchRoot } = await openedRepos(cli, store);
  const root = launchRoot ?? repos.list[0]!.root;
  const initial = await initialComparison({ root, store, cli });

  // services belong to this process: never leave them behind
  process.on('exit', stopAllSessions);
  // Ghostty and xterm keep ⇧ for their own selection unless the app asks
  // (XTSHIFTESCAPE); without it ⇧+wheel never arrives to scroll sideways
  process.stdout.write(SHIFT_TO_APP);
  process.on('exit', () => process.stdout.write(SHIFT_TO_TERMINAL));
  for (const signal of ['SIGTERM', 'SIGHUP', 'SIGINT'] as const) {
    process.on(signal, () => process.exit(0));
  }

  const commandKey = trackCommandKey();
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
    targetFps: 60,
    backgroundColor: 'transparent',
    useKittyKeyboard: { events: true, allKeysAsEscapes: true },
    prependInputHandlers: [commandKey.handle],
  });
  renderer.on('blur', commandKey.forget);
  const settings = loadSettings(store);
  const [system, terminal] = await Promise.all([
    readSystemScheme(),
    readTerminalLook(renderer),
  ]);
  const start = { settings, system, terminal, override: cli.themeName };
  const look = await resolveLook(start);
  renderer.setBackgroundColor(look.palette.frame);
  createRoot(renderer).render(
    <Shell
      repos={repos}
      launchRoot={launchRoot}
      focus={root}
      store={store}
      themeStart={{ ...start, look }}
      initial={initial}
      startServer={cli.startServer}
      commandKey={commandKey}
    />,
  );
}

/**
 * The saved workspace named, the paths given side by side, the one
 * repository started in — reopening the workspace last opened from it — or,
 * started in a folder of repositories, that folder's workspace.
 */
async function openedRepos(
  cli: CliOptions,
  store: Store,
): Promise<{ repos: Repos; launchRoot: string | null }> {
  if (cli.workspace !== undefined) {
    const wanted = cli.workspace.toLowerCase();
    const saved = (await savedWorkspaces(cli)).find(
      (candidate) =>
        candidate.id === cli.workspace ||
        candidate.name.toLowerCase() === wanted,
    );
    if (!saved)
      fail(`no saved workspace named "${cli.workspace}" — see --workspaces`);
    const roots = await existingRoots([...saved.roots]);
    if (roots.length === 0)
      fail(`none of ${saved.name}'s repositories are on disk any more`);
    return {
      repos: reposOf(roots, { id: saved.id, name: saved.name }),
      launchRoot: null,
    };
  }
  if (cli.paths.length === 1) {
    const folder = cli.paths[0]!;
    const inRepo = await repoRoot(folder).catch(() => null);
    if (inRepo === null)
      return { repos: await folderRepos(cli, folder), launchRoot: null };
  }
  const roots = [
    ...new Set(
      await Promise.all(
        cli.paths.map((path) =>
          repoRoot(path).catch(() => fail(`not a git repository: ${path}`)),
        ),
      ),
    ),
  ];
  if (roots.length > 1) return { repos: reposOf(roots), launchRoot: null };
  const root = roots[0]!;
  const lastId = loadUiState(store, root).lastWorkspace;
  const last = lastId ? await lastWorkspace(cli, root, lastId) : null;
  if (last?.roots.includes(root)) {
    const saved = await existingRoots([...last.roots]);
    if (saved.length > 1)
      return {
        repos: reposOf(saved, { id: last.id, name: last.name }),
        launchRoot: root,
      };
  }
  return { repos: reposOf([root]), launchRoot: root };
}

/** A folder of repositories opens as its workspace; the server is started to keep it. */
async function folderRepos(cli: CliOptions, folder: string): Promise<Repos> {
  if (cli.startServer) await ensureServer(folder);
  const found = await folderWorkspace(folder);
  if (!found) fail(`not a git repository, nor a folder of them: ${folder}`);
  return reposOf(found.roots, found.workspace);
}

/** The server keeps the saved workspaces: started for them when it may be. */
async function savedWorkspaces(
  cli: CliOptions,
): Promise<readonly SavedWorkspace[]> {
  if (cli.startServer) await ensureServer(cli.paths[0]!);
  return workspaces
    .list()
    .catch((error: unknown) =>
      fail(error instanceof Error ? error.message : String(error)),
    );
}

/** The workspace last opened from `root`, if the server can still say what it is. */
async function lastWorkspace(
  cli: CliOptions,
  root: string,
  id: string,
): Promise<SavedWorkspace | null> {
  if (cli.startServer) await ensureServer(root);
  return workspaces.find(id).catch(() => null);
}

/** The repositories still on disk, as their roots; the rest left out. */
async function existingRoots(paths: string[]): Promise<string[]> {
  const roots = await Promise.all(
    paths.map((path) => repoRoot(path).catch(() => null)),
  );
  return [...new Set(roots.filter((root): root is string => root !== null))];
}

/** What was asked for, else the branch's recorded target, else uncommitted work. */
async function initialComparison(opts: {
  root: string;
  store: Store;
  cli: CliOptions;
}): Promise<Comparison> {
  const { root, store, cli } = opts;
  if (cli.pr !== undefined) {
    const number = Number(cli.pr);
    if (!Number.isInteger(number) || number <= 0)
      fail(`--pr takes a pull request number, not ${cli.pr}`);
    return { kind: 'pull', number };
  }
  if (cli.commit) {
    if (!(await resolves(root, cli.commit))) fail(`no commit ${cli.commit}`);
    const sha = (await git(root, ['rev-parse', cli.commit])).trim();
    return { kind: 'commit', sha };
  }
  if (cli.against) {
    if (!(await resolves(root, cli.against))) fail(`no ref ${cli.against}`);
    return { kind: 'branch', against: cli.against };
  }
  const { branch } = await repoInfo(root);
  const aim = branch ? store.branchAim(root, branch) : null;
  if (aim && aim !== branch && (await resolves(root, aim))) {
    return { kind: 'branch', against: aim };
  }
  return WORKTREE;
}

function exit(message: string): never {
  console.log(message);
  process.exit(0);
}

function fail(message: string): never {
  console.error(`reviewer: ${message}`);
  process.exit(1);
}
