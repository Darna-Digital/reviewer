import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { DevCommand } from '@reviewer/core/local-dev';
import * as React from 'react';
import { PtySession, forgetSession, trackSession } from '../process/ptySession';
import type { SessionStatus } from '../process/ptySession';
import { inRepo } from '../repos/repos';
import type { Repo, Repos } from '../repos/repos';
import type { NewDevCommand, Store } from '../store/createStore';
import type { Review } from './useReview';

export type Services = ReturnType<typeof useServices>;

/** A service and the workspace repository it runs in. */
export interface RepoCommand extends DevCommand {
  repo: Repo;
  /** Where it runs, as a workspace path: `api/web`, or `.` for the root of the only one. */
  folder: string;
}

const POLL_MS = 2000;

/**
 * Every repository's services — the commands the Mac app's Run pane keeps —
 * run here on pseudo-terminals. Definitions are shared through the database;
 * the processes belong to this TUI and stop when it quits. New ones are
 * added to the focused repository.
 */
export function useServices(review: Review, store: Store) {
  const { repos, focused } = review;
  const [commands, setCommands] = React.useState<RepoCommand[]>(() =>
    readCommands(store, repos),
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [tableScroll, setTableScroll] = React.useState(0);
  const [, redraw] = React.useReducer((n: number) => n + 1, 0);
  const sessions = React.useRef(new Map<string, PtySession>());
  const size = React.useRef({ cols: 100, rows: 20 });

  // definitions added or removed in the app show up here too
  React.useEffect(() => {
    const poll = setInterval(() => {
      const next = readCommands(store, repos);
      setCommands((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [repos, store]);

  const selected =
    commands.find((command) => command.id === selectedId) ?? commands[0];

  return {
    /** Columns the commands table is scrolled sideways; the pane clamps it. */
    tableScroll,
    scrollTable: (delta: number) =>
      setTableScroll((x) => Math.max(0, x + delta)),
    clampTable: (max: number) => setTableScroll((x) => Math.min(x, max)),
    commands,
    selected,
    select: setSelectedId,
    sessionOf,
    statusOf(id: string): SessionStatus {
      return sessions.current.get(id)?.status ?? 'stopped';
    },
    exitCodeOf: (id: string) => sessions.current.get(id)?.exitCode ?? null,
    running: () =>
      commands.filter(
        (command) => sessions.current.get(command.id)?.status === 'running',
      ),
    /** The output view reports its size so processes start at the right width. */
    setSize(cols: number, rows: number) {
      size.current = { cols, rows };
    },
    start,
    stop: (id: string) => sessions.current.get(id)?.stop(),
    toggle(id: string) {
      if (sessions.current.get(id)?.status === 'running')
        sessions.current.get(id)?.stop();
      else start(id);
    },
    startAll() {
      for (const command of commands) start(command.id);
    },
    stopAll() {
      for (const session of sessions.current.values()) session.stop();
    },
    /** The repository a new service is added to. */
    addsTo: focused,
    add(input: NewDevCommand): string | null {
      const { root } = focused;
      const folder = join(root, input.cwd ?? '');
      if (!isDirectory(folder) || !folder.startsWith(root)) {
        return `No folder ${input.cwd} in ${repos.spans ? focused.name : 'this repository'}`;
      }
      const created = store.addDevCommand(root, input);
      setCommands(readCommands(store, repos));
      setSelectedId(created.id);
      return null;
    },
    remove(id: string) {
      const session = sessions.current.get(id);
      if (session) forgetSession(session);
      sessions.current.delete(id);
      const owner = commands.find((command) => command.id === id)?.repo;
      if (owner) store.removeDevCommand(owner.root, id);
      setCommands(readCommands(store, repos));
    },
  };

  function sessionOf(id: string): PtySession | undefined {
    return sessions.current.get(id);
  }

  function start(id: string) {
    const command = commands.find((candidate) => candidate.id === id);
    if (!command) return;
    let session = sessions.current.get(id);
    if (!session) {
      session = trackSession(new PtySession(id, command.name));
      session.onChange(redraw);
      sessions.current.set(id, session);
    }
    session.start({
      command: command.command,
      cwd: join(command.repo.root, command.cwd),
      ...size.current,
    });
    setSelectedId(id);
  }
}

function readCommands(store: Store, repos: Repos): RepoCommand[] {
  return repos.list.flatMap((repo) =>
    store.devCommands(repo.root).map((command) => ({
      ...command,
      repo,
      folder: repos.spans
        ? inRepo(repos, repo, command.cwd).replace(/\/$/, '')
        : command.cwd || '.',
    })),
  );
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
