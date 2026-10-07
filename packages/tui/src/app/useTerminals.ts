import * as React from 'react';
import { PtySession, forgetSession, trackSession } from '../process/ptySession';

export type Terminals = ReturnType<typeof useTerminals>;

let counter = 0;

/** Interactive shells in the bottom pane's Terminal tab. */
export function useTerminals(root: string) {
  const [shells, setShells] = React.useState<PtySession[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [, redraw] = React.useReducer((n: number) => n + 1, 0);
  const size = React.useRef({ cols: 100, rows: 20 });

  const active = shells.find((shell) => shell.id === activeId) ?? shells.at(-1);

  return {
    shells,
    active,
    activate: setActiveId,
    setSize(cols: number, rows: number) {
      size.current = { cols, rows };
    },
    open() {
      counter += 1;
      const shell = trackSession(
        new PtySession(`shell-${counter}`, `Shell ${counter}`),
      );
      shell.onChange(redraw);
      shell.start({ cwd: root, ...size.current });
      setShells((list) => [...list, shell]);
      setActiveId(shell.id);
    },
    close(id: string) {
      const index = shells.findIndex((shell) => shell.id === id);
      const shell = shells[index];
      if (!shell) return;
      forgetSession(shell);
      const rest = shells.filter((other) => other.id !== id);
      setShells(rest);
      if (id === active?.id)
        setActiveId(rest[Math.min(index, rest.length - 1)]?.id ?? null);
    },
    step(delta: number) {
      if (shells.length === 0 || !active) return;
      const index = shells.indexOf(active);
      setActiveId(shells[(index + delta + shells.length) % shells.length]!.id);
    },
  };
}
