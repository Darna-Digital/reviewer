import { statSync } from 'node:fs';
import { join } from 'node:path';
import type { DevCommand } from '@reviewer/core/local-dev';
import * as React from 'react';
import { PtySession, forgetSession, trackSession } from '../process/ptySession';
import type { SessionStatus } from '../process/ptySession';
import type { NewDevCommand, Store } from '../store/createStore';
import type { Review } from './useReview';

export type Services = ReturnType<typeof useServices>;

const POLL_MS = 2000;

/**
 * The repository's services — the commands the Mac app's Run pane keeps — run
 * here on pseudo-terminals. Definitions are shared through the database; the
 * processes belong to this TUI and stop when it quits.
 */
export function useServices(review: Review, store: Store) {
  const { root } = review;
  const [commands, setCommands] = React.useState<DevCommand[]>(() =>
    store.devCommands(root),
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [tableScroll, setTableScroll] = React.useState(0);
  const [, redraw] = React.useReducer((n: number) => n + 1, 0);
  const sessions = React.useRef(new Map<string, PtySession>());
  const size = React.useRef({ cols: 100, rows: 20 });

  // definitions added or removed in the app show up here too
  React.useEffect(() => {
    const poll = setInterval(() => {
      const next = store.devCommands(root);
      setCommands((prev) =>
        JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    }, POLL_MS);
    return () => clearInterval(poll);
  }, [root, store]);

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
    add(input: NewDevCommand): string | null {
      const folder = join(root, input.cwd ?? '');
      if (!isDirectory(folder) || !folder.startsWith(root)) {
        return `No folder ${input.cwd} in this repository`;
      }
      const created = store.addDevCommand(root, input);
      setCommands(store.devCommands(root));
      setSelectedId(created.id);
      return null;
    },
    remove(id: string) {
      const session = sessions.current.get(id);
      if (session) forgetSession(session);
      sessions.current.delete(id);
      store.removeDevCommand(root, id);
      setCommands(store.devCommands(root));
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
      cwd: join(root, command.cwd),
      ...size.current,
    });
    setSelectedId(id);
  }
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}
