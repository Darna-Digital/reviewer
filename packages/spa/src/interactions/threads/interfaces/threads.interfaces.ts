/**
 * `threads` feature — creating terminal threads, running commands in them, and
 * renaming them. The light orchestration (trimming input, skipping blank
 * commands, threading the current title through a branch edit) lives here
 * behind injected API side effects so it stays unit-testable without a server.
 */
import type { AgentKind, Thread, ThreadEntry } from "@reviewer/core/threads";

export interface ThreadsDependencies {
  data: Record<string, never>;
  sideEffects: {
    readonly create: (input: {
      title?: string;
      agent: AgentKind;
      branch?: string;
    }) => Promise<Thread>;
    readonly run: (id: string, command: string) => Promise<ThreadEntry>;
    readonly rename: (
      id: string,
      input: { title: string; branch?: string }
    ) => Promise<Thread>;
    readonly remove: (id: string) => Promise<void>;
  };
}

export interface ThreadsFunctions {
  /** Create a thread bound to an agent, grouped under `branch`; an empty title
   * uses the server default. */
  readonly create: (
    agent: AgentKind,
    title: string,
    branch: string
  ) => Promise<Thread>;
  /** Run a command; returns null (no-op) when the command is blank. */
  readonly run: (id: string, command: string) => Promise<ThreadEntry | null>;
  readonly rename: (id: string, title: string) => Promise<Thread>;
  /** Move a thread to another branch group without changing the title. */
  readonly setBranch: (
    id: string,
    currentTitle: string,
    branch: string
  ) => Promise<Thread>;
  readonly remove: (id: string) => Promise<void>;
}
