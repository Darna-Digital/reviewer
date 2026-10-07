#!/usr/bin/env bun
import { createCliRenderer } from '@opentui/core';
import { createRoot } from '@opentui/react';
import { describeThemes, findTheme } from '@reviewer/core/themes';
import { App } from './app/App';
import { WORKTREE } from './app/comparison';
import type { Comparison } from './app/comparison';
import { parseCli, USAGE } from './cli';
import type { CliOptions } from './cli';
import { git, resolves } from './git/exec';
import { repoInfo, repoRoot } from './git/repo';
import { readTerminalLook } from './app/useTheme';
import { stopAllSessions } from './process/ptySession';
import { loadSettings, TERMINAL_THEME } from './store/settings';
import { resolveLook } from './theme/resolveLook';
import { readSystemScheme } from './theme/systemAppearance';
import { openStore } from './store/createStore';
import type { Store } from './store/createStore';

await main(parseCli(Bun.argv.slice(2)));

async function main(cli: CliOptions) {
  if (cli.help) return exit(USAGE);
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

  const root = await repoRoot(cli.path).catch(() =>
    fail(`not a git repository: ${cli.path}`),
  );
  const store = openStore();
  const initial = await initialComparison({ root, store, cli });

  // services and shells belong to this process: never leave them behind
  process.on('exit', stopAllSessions);
  for (const signal of ['SIGTERM', 'SIGHUP', 'SIGINT'] as const) {
    process.on(signal, () => process.exit(0));
  }

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
    targetFps: 60,
    backgroundColor: 'transparent',
  });
  const settings = loadSettings();
  const [system, terminal] = await Promise.all([
    readSystemScheme(),
    readTerminalLook(renderer),
  ]);
  const start = { settings, system, terminal, override: cli.themeName };
  const look = await resolveLook(start);
  renderer.setBackgroundColor(look.palette.frame);
  createRoot(renderer).render(
    <App
      root={root}
      store={store}
      themeStart={{ ...start, look }}
      initial={initial}
      startServer={cli.startServer}
    />,
  );
}

/** What was asked for, else the branch's recorded target, else uncommitted work. */
async function initialComparison(opts: {
  root: string;
  store: Store;
  cli: CliOptions;
}): Promise<Comparison> {
  const { root, store, cli } = opts;
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
