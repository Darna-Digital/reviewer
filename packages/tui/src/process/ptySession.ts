import type { Subprocess } from 'bun';

export type SessionStatus = 'stopped' | 'running' | 'exited';

export interface StartOptions {
  /** A shell command line; omitted for an interactive shell. */
  command?: string;
  cwd: string;
  cols: number;
  rows: number;
}

type Listener = (data: Uint8Array) => void;

/** Scrollback kept for a viewer that attaches late — the server's cap. */
const SCROLLBACK_BYTES = 256_000;

/**
 * A process on a pseudo-terminal with its scrollback, so a view can attach,
 * detach and re-attach (replaying what it missed) while the process runs on.
 */
export class PtySession {
  status: SessionStatus = 'stopped';
  exitCode: number | null = null;
  private proc: Subprocess | null = null;
  private chunks: Uint8Array[] = [];
  private bytes = 0;
  private listeners = new Set<Listener>();
  private changeListeners = new Set<() => void>();
  private size = { cols: 80, rows: 24 };

  constructor(
    public readonly id: string,
    public title: string,
  ) {}

  start(opts: StartOptions) {
    this.stop();
    this.clear();
    this.size = { cols: opts.cols, rows: opts.rows };
    const shell = process.env['SHELL'] || '/bin/sh';
    const argv = opts.command
      ? [shell, '-l', '-i', '-c', opts.command]
      : [shell, '-l', '-i'];
    const proc = Bun.spawn(argv, {
      cwd: opts.cwd,
      env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
      terminal: {
        cols: opts.cols,
        rows: opts.rows,
        data: (_terminal, data) => this.push(data),
      },
    });
    this.proc = proc;
    this.status = 'running';
    this.exitCode = null;
    this.changed();
    void proc.exited.then((code) => {
      if (this.proc !== proc) return;
      this.proc = null;
      this.status = 'exited';
      this.exitCode = code;
      this.changed();
    });
  }

  stop() {
    const proc = this.proc;
    if (!proc) return;
    this.proc = null;
    proc.terminal?.close();
    proc.kill();
    this.status = 'exited';
    this.exitCode = null;
    this.changed();
  }

  write(data: string | Uint8Array) {
    this.proc?.terminal?.write(data);
  }

  resize(cols: number, rows: number) {
    if (cols === this.size.cols && rows === this.size.rows) return;
    this.size = { cols, rows };
    this.proc?.terminal?.resize(cols, rows);
  }

  /** Replays the scrollback into `listener`, then streams; returns detach. */
  attach(listener: Listener): () => void {
    for (const chunk of this.chunks) listener(chunk);
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called on start, stop and exit. */
  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private push(data: Uint8Array) {
    const copy = new Uint8Array(data);
    this.chunks.push(copy);
    this.bytes += copy.length;
    while (this.bytes > SCROLLBACK_BYTES && this.chunks.length > 1) {
      this.bytes -= this.chunks.shift()!.length;
    }
    for (const listener of this.listeners) listener(copy);
  }

  private clear() {
    this.chunks = [];
    this.bytes = 0;
  }

  private changed() {
    for (const listener of this.changeListeners) listener();
  }
}

const live = new Set<PtySession>();

export function trackSession(session: PtySession): PtySession {
  live.add(session);
  return session;
}

export function forgetSession(session: PtySession) {
  session.stop();
  live.delete(session);
}

/** Stops every process this TUI started — on quit, nothing is left behind. */
export function stopAllSessions() {
  for (const session of live) session.stop();
}
