/**
 * WorkspaceContext — the mutable "what is open" state, shared across features
 * (Git exec, comments, GitHub all read the current repo from here). It is the
 * server's analogue of a database connection in the darna-stack: a single infra
 * service the feature repositories build on.
 *
 * What is open is one git repository — the project. It is persisted to
 * ~/.reviewer/state.json together with the repositories opened before and
 * when each was, and seeded at boot from REVIEWER_REPO / cwd. Only primitives
 * (paths, timestamps) cross this boundary — domain shapes live in the
 * workspace feature's schema.
 *
 * Several servers can be up at once — one per Reviewer window, each on its
 * own port — sharing the one state file, so a write folds into what the
 * file holds by then rather than replacing it. A server booted on an
 * explicit REVIEWER_REPO is a window opened beside the main one, and leaves
 * the remembered project to that one: the next plain launch comes back to
 * where the main window was, not to whichever window wrote last.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { homedir } from "node:os";
import { NoRepoSelected } from "@reviewer/core/shared";
import { folderName, InvalidRepo } from "@reviewer/core/workspace";
import { importLegacyJson } from "../db/legacy-import.ts";
import { rememberProject } from "../db/scope.ts";
import { getCurrentRepo, setCurrentRepo } from "./current-repo.ts";

/** A repository opened before, and when it last was. */
export interface OpenedRepo {
  readonly path: string;
  readonly openedAt: string;
}

export interface WorkspaceContextShape {
  /** The open repository, or fail with NoRepoSelected when none is. */
  readonly requireCurrent: Effect.Effect<string, NoRepoSelected>;
  /** The open repository, or null when nothing is open. */
  readonly current: Effect.Effect<string | null>;
  /** Recently opened repositories, most-recent first. */
  readonly recents: Effect.Effect<ReadonlyArray<string>>;
  /** Every repository opened here, with its last open, most-recent first. */
  readonly opened: Effect.Effect<ReadonlyArray<OpenedRepo>>;
  /** Open an already-resolved repository root as the project, and persist it. */
  readonly selectRepo: (repo: string) => Effect.Effect<void>;
  /** The user's home directory (for the picker's default browse root). */
  readonly home: string;
}

export class WorkspaceContext extends Context.Service<
  WorkspaceContext,
  WorkspaceContextShape
>()("WorkspaceContext") {}

const STATE_DIR = `${homedir()}/.reviewer`;
const STATE_FILE = `${STATE_DIR}/state.json`;
const MAX_RECENTS = 20;

interface PersistedState {
  /** The open repository. */
  readonly current: string | null;
  /** Repositories opened before, most-recent first, each with its last open. */
  readonly recents: ReadonlyArray<OpenedRepo>;
}

export interface InitialSelection {
  readonly path: string;
  /** Explicit (REVIEWER_REPO) beats persisted state; a cwd guess does not. */
  readonly explicit: boolean;
}

/** Resolve a path to its repository root, or explain why it isn't one. */
export const validateRepo = (
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  path: string
) =>
  Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(
        ChildProcess.make("git", ["-C", path, "rev-parse", "--show-toplevel"])
      );
      const [stdout, stderr, exitCode] = yield* Effect.all(
        [
          Stream.mkString(Stream.decodeText(handle.stdout)),
          Stream.mkString(Stream.decodeText(handle.stderr)),
          handle.exitCode,
        ],
        { concurrency: "unbounded" }
      );
      if (exitCode !== 0) {
        return yield* Effect.fail(
          new InvalidRepo({ path, reason: stderr.trim() })
        );
      }
      return stdout.trim();
    })
  );

/**
 * The repository root `path` belongs to — itself or an ancestor — or null
 * when it is not a directory inside a repository.
 */
export const resolveRepo = (
  fs: FileSystem.FileSystem,
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  path: string
) =>
  Effect.gen(function* () {
    const stat = yield* fs
      .stat(path)
      .pipe(Effect.catch(() => Effect.succeed(null)));
    if (stat === null || stat.type !== "Directory") return null;
    return yield* validateRepo(spawner, path).pipe(
      Effect.catch(() => Effect.succeed(null))
    );
  });

/**
 * State written before opens were dated listed recents as bare paths. Those
 * are dated from when the file was last written, a second apart so the order
 * they were kept in survives — the file was written at the newest open.
 */
const readRecents = (
  raw: unknown,
  writtenAt: Date
): ReadonlyArray<OpenedRepo> => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry: unknown, index): OpenedRepo[] => {
    if (typeof entry === "string") {
      return [
        {
          path: entry,
          openedAt: new Date(writtenAt.getTime() - index * 1000).toISOString(),
        },
      ];
    }
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as { path?: unknown }).path === "string" &&
      typeof (entry as { openedAt?: unknown }).openedAt === "string"
    ) {
      const { openedAt, path } = entry as OpenedRepo;
      return [{ path, openedAt }];
    }
    return [];
  });
};

/** Two windows' opens as one list, each repository at its latest, newest first. */
const mergeOpened = (
  ours: ReadonlyArray<OpenedRepo>,
  theirs: ReadonlyArray<OpenedRepo>
): ReadonlyArray<OpenedRepo> => {
  const latest = new Map<string, string>();
  for (const entry of [...ours, ...theirs]) {
    const known = latest.get(entry.path);
    if (known === undefined || known < entry.openedAt) {
      latest.set(entry.path, entry.openedAt);
    }
  }
  return [...latest]
    .map(([path, openedAt]) => ({ path, openedAt }))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))
    .slice(0, MAX_RECENTS);
};

export const make = (initial: InitialSelection | null) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    const EMPTY_STATE: PersistedState = { current: null, recents: [] };

    const readState: Effect.Effect<PersistedState> = Effect.gen(function* () {
      const present = yield* fs.exists(STATE_FILE);
      if (!present) return EMPTY_STATE;
      const raw = yield* fs.readFileString(STATE_FILE);
      const writtenAt = yield* fs.stat(STATE_FILE).pipe(
        Effect.map((info) => Option.getOrElse(info.mtime, () => new Date())),
        Effect.catch(() => Effect.succeed(new Date()))
      );
      try {
        const parsed = JSON.parse(raw);
        return {
          current: typeof parsed?.current === "string" ? parsed.current : null,
          recents: readRecents(parsed?.recents, writtenAt),
        };
      } catch {
        return EMPTY_STATE;
      }
    }).pipe(Effect.catch(() => Effect.succeed(EMPTY_STATE)));

    const writeState = (state: PersistedState) =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(STATE_DIR, { recursive: true });
        yield* fs.writeFileString(STATE_FILE, JSON.stringify(state, null, 2));
      }).pipe(Effect.catch(() => Effect.void));

    const validOrNull = (path: string | null) =>
      path === null ? Effect.succeed(null) : resolveRepo(fs, spawner, path);

    // Boot order: explicit REVIEWER_REPO > last repository used > cwd guess.
    const persisted = yield* readState;
    const explicitValid =
      initial !== null && initial.explicit
        ? yield* validOrNull(initial.path)
        : null;
    const persistedValid =
      explicitValid === null ? yield* validOrNull(persisted.current) : null;
    const fallbackValid =
      explicitValid === null && persistedValid === null
        ? yield* validOrNull(
            initial !== null && !initial.explicit ? initial.path : null
          )
        : null;

    const initialRepo = explicitValid ?? persistedValid ?? fallbackValid;
    const recentsRef = yield* Ref.make<ReadonlyArray<OpenedRepo>>(
      persisted.recents
    );

    const remembersCurrent = explicitValid === null;

    const persist = Effect.gen(function* () {
      const onDisk = yield* readState;
      yield* writeState({
        current: remembersCurrent ? getCurrentRepo() : onDisk.current,
        recents: mergeOpened(yield* Ref.get(recentsRef), onDisk.recents),
      });
    });

    /**
     * Register the repository and take across anything it still keeps in
     * `.reviewer/*.json`. Neither call fails an open — a repository that
     * cannot be recorded is still one the user can work in.
     */
    const adopt = (repo: string) =>
      Effect.sync(() => {
        try {
          rememberProject(repo, [{ name: folderName(repo), path: repo }]);
          importLegacyJson(repo);
        } catch (error) {
          console.warn(
            "reviewer: could not register the open repository —",
            error instanceof Error ? error.message : error
          );
        }
      });

    const open = (repo: string) =>
      Effect.gen(function* () {
        yield* adopt(repo);
        // `current-repo.ts` is the single store for the selection: an Effect
        // Ref couldn't be read by the PTY socket / chat runtime, which run
        // outside the Effect runtime, so those (and this service) share the
        // one module snapshot.
        setCurrentRepo(repo);
      });

    if (initialRepo !== null) yield* open(initialRepo);

    const current: Effect.Effect<string | null> = Effect.sync(getCurrentRepo);

    const selectRepo: WorkspaceContextShape["selectRepo"] = (repo) =>
      Effect.gen(function* () {
        yield* open(repo);
        const openedAt = new Date().toISOString();
        yield* Ref.update(recentsRef, (existing) =>
          [
            { path: repo, openedAt },
            ...existing.filter((entry) => entry.path !== repo),
          ].slice(0, MAX_RECENTS)
        );
        yield* persist;
      });

    return WorkspaceContext.of({
      home: homedir(),
      current,
      recents: Effect.map(Ref.get(recentsRef), (recents) =>
        recents.map((entry) => entry.path)
      ),
      opened: Ref.get(recentsRef),
      requireCurrent: current.pipe(
        Effect.flatMap((selected) =>
          selected === null
            ? Effect.fail(new NoRepoSelected())
            : Effect.succeed(selected)
        )
      ),
      selectRepo,
    });
  });

export const layer = (
  initial: InitialSelection | null
): Layer.Layer<
  WorkspaceContext,
  never,
  FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
> => Layer.effect(WorkspaceContext)(make(initial));

/** Test seam: an in-memory context with no filesystem/git/persistence. */
export const makeMemory = (initial: string | null = null) =>
  Effect.gen(function* () {
    const currentRef = yield* Ref.make<string | null>(initial);
    const recentsRef = yield* Ref.make<ReadonlyArray<OpenedRepo>>(
      initial === null
        ? []
        : [{ path: initial, openedAt: "2026-01-01T00:00:00.000Z" }]
    );
    return WorkspaceContext.of({
      home: "/home/test",
      current: Ref.get(currentRef),
      recents: Effect.map(Ref.get(recentsRef), (recents) =>
        recents.map((entry) => entry.path)
      ),
      opened: Ref.get(recentsRef),
      requireCurrent: Ref.get(currentRef).pipe(
        Effect.flatMap((selected) =>
          selected === null
            ? Effect.fail(new NoRepoSelected())
            : Effect.succeed(selected)
        )
      ),
      selectRepo: (repo) =>
        Effect.gen(function* () {
          yield* Ref.set(currentRef, repo);
          yield* Ref.update(recentsRef, (existing) => [
            { path: repo, openedAt: "2026-01-01T00:00:00.000Z" },
            ...existing.filter((entry) => entry.path !== repo),
          ]);
        }),
    });
  });

export const memoryLayer = (
  initial: string | null = null
): Layer.Layer<WorkspaceContext> =>
  Layer.effect(WorkspaceContext)(makeMemory(initial));
