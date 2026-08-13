/**
 * `local-dev` feature — JetBrains-style run configurations: CRUD over named dev
 * commands plus start/stop (individually, per repository, or across the whole
 * project). Every command belongs to one of the project's git roots, so each
 * write says which root it lands in and run-all/stop-all can be narrowed to one.
 * The light validation (trimming, defaulting a blank name to the command,
 * skipping a blank command or a command with no repository) lives here behind
 * injected API side effects so it stays unit-testable without a server.
 */
import type { DevCommand } from "@byconvo/core/local-dev";

export interface LocalDevDependencies {
  data: Record<string, never>;
  sideEffects: {
    readonly create: (input: {
      name: string;
      command: string;
      repoPath: string;
    }) => Promise<DevCommand>;
    readonly update: (
      id: string,
      input: { name: string; command: string; repoPath: string }
    ) => Promise<DevCommand>;
    readonly remove: (id: string) => Promise<void>;
    readonly start: (id: string) => Promise<void>;
    readonly stop: (id: string) => Promise<void>;
    /** Every command in the project, or only those of one root. */
    readonly startAll: (repoPath?: string) => Promise<void>;
    readonly stopAll: (repoPath?: string) => Promise<void>;
  };
}

export interface LocalDevFunctions {
  /** Create a command in a repository; returns null (no-op) when the command or
   * the repository is blank. A blank name defaults to the command text. */
  readonly create: (
    name: string,
    command: string,
    repoPath: string
  ) => Promise<DevCommand | null>;
  /** Update a command; returns null (no-op) when the command or repo is blank. */
  readonly update: (
    id: string,
    name: string,
    command: string,
    repoPath: string
  ) => Promise<DevCommand | null>;
  readonly remove: (id: string) => Promise<void>;
  readonly start: (id: string) => Promise<void>;
  readonly stop: (id: string) => Promise<void>;
  readonly startAll: (repoPath?: string) => Promise<void>;
  readonly stopAll: (repoPath?: string) => Promise<void>;
}
