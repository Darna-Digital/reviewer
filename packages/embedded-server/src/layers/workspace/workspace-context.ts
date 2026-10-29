/**
 * WorkspaceContext — the mutable "what is open" state, shared across features
 * (Git exec, comments, GitHub all read the current repo from here). It is the
 * server's analogue of a database connection in the darna-stack: a single infra
 * service the feature repositories build on.
 *
 * What is open is a workspace: one or more git repositories side by side —
 * its roots — and, when they are a saved workspace, which one. Which root a
 * request runs against is the request's to say (`requested-repo.ts`);
 * `current` and `requireCurrent` answer with that root, or the workspace's
 * first for a request that names none. What is open is persisted to
 * ~/.reviewer/state.json together with the repositories opened before and
 * when each was, and seeded at boot from REVIEWER_REPO / cwd. Only primitives
 * (paths, timestamps, ids) cross this boundary — domain shapes live in the
 * workspace feature's schema.
 *
 * Several servers can be up at once — one per Reviewer window, each on its
 * own port — sharing the one state file, so a write folds into what the
 * file holds by then rather than replacing it. A server booted on an
 * explicit REVIEWER_REPO is a window opened beside the main one, and leaves
 * the remembered workspace to that one: the next plain launch comes back to
 * where the main window was, not to whichever window wrote last.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { homedir } from "node:os";
import { NoRepoSelected } from "@reviewer/core/shared";
import { folderName, InvalidRepo } from "@reviewer/core/workspace";
import { importLegacyJson } from "../db/legacy-import.ts";
import { rememberProject } from "../db/scope.ts";
import { getCurrentRepo, getOpenRoots, setOpenRoots } from "./current-repo.ts";
import { RequestedRepo } from "./requested-repo.ts";
import { findWorkspace } from "./saved-workspaces.ts";

/** A repository opened before, and when it last was. */
export interface OpenedRepo {
  readonly path: string;
  readonly openedAt: string;
}

export interface WorkspaceContextShape {
  /**
   * The root the request in flight runs against — the one it named, or the
   * workspace's first — or fail with NoRepoSelected when nothing is open or
   * the root it named is not.
   */
  readonly requireCurrent: Effect.Effect<string, NoRepoSelected>;
  /** The same root, or null where `requireCurrent` would fail. */
  readonly current: Effect.Effect<string | null>;
  /** Every repository open side by side, in the workspace's order. */
  readonly roots: Effect.Effect<ReadonlyArray<string>>;
  /** The saved workspace the roots are, or null for roots opened on their own. */
  readonly savedId: Effect.Effect<string | null>;
  /** Recently opened repositories, most-recent first. */
  readonly recents: Effect.Effect<ReadonlyArray<string>>;
  /** Every repository opened here, with its last open, most-recent first. */
  readonly opened: Effect.Effect<ReadonlyArray<OpenedRepo>>;
  /** Open an already-resolved repository root on its own, and persist it. */
  readonly selectRepo: (repo: string) => Effect.Effect<void>;
  /**
   * Open already-resolved roots side by side — those of the saved workspace
   * `savedId`, or of none — and persist them.
   */
  readonly openRoots: (
    roots: ReadonlyArray<string>,
    savedId: string | null
  ) => Effect.Effect<void>;
  /** The user's home directory (for the picker's default browse root). */
  readonly home: string;
}

export class WorkspaceContext extends Context.Service<
  WorkspaceContext,
  WorkspaceContextShape
>()("WorkspaceContext") {}

/**
 * The root the request in flight runs against, given the roots open: the one
 * it named when that is open, the first when it named none. A root it named
 * that is not open answers null rather than falling back to another — a
 * commit meant for one repository must never land in its neighbour.
 */
const requestedRoot = (roots: Effect.Effect<ReadonlyArray<string>>) =>
  Effect.gen(function* () {
    const requested = yield* RequestedRepo;
    const open = yield* roots;
    const root =
      requested === null
        ? (open[0] ?? null)
        : open.includes(requested)
          ? requested
          : null;
    return { requested, root };
  });

const currentOf = (roots: Effect.Effect<ReadonlyArray<string>>) =>
  Effect.map(requestedRoot(roots), ({ root }) => root);

const requireCurrentOf = (roots: Effect.Effect<ReadonlyArray<string>>) =>
  Effect.flatMap(requestedRoot(roots), ({ requested, root }) =>
    root !== null
      ? Effect.succeed(root)
      : Effect.fail(
          requested === null
            ? new NoRepoSelected()
            : new NoRepoSelected({ repo: requested })
        )
  );

const STATE_DIR = `${homedir()}/.reviewer`;
const STATE_FILE = `${STATE_DIR}/state.json`;
const MAX_RECENTS = 20;

interface PersistedState {
  /** The workspace's first root — what states written before workspaces kept. */
  readonly current: string | null;
  /** Every root open side by side. */
  readonly roots: ReadonlyArray<string>;
  /** The saved workspace those roots are, or null. */
  readonly workspace: string | null;
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

    const EMPTY_STATE: PersistedState = {
      current: null,
      roots: [],
      workspace: null,
      recents: [],
    };

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
        const current =
          typeof parsed?.current === "string" ? parsed.current : null;
        const roots: ReadonlyArray<string> = Array.isArray(parsed?.roots)
          ? parsed.roots.filter(
              (root: unknown): root is string => typeof root === "string"
            )
          : [];
        return {
          current,
          // A state written before workspaces kept the one repository only.
          roots: roots.length > 0 ? roots : current === null ? [] : [current],
          workspace:
            typeof parsed?.workspace === "string" ? parsed.workspace : null,
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

    /** Each path that is still a repository, as its root; the rest dropped. */
    const validRoots = (paths: ReadonlyArray<string>) =>
      Effect.map(Effect.forEach(paths, validOrNull), (roots) =>
        roots.filter((root): root is string => root !== null)
      );

    // Boot order: explicit REVIEWER_REPO > the workspace last open > cwd
    // guess. A remembered root that has gone from disk is dropped rather than
    // failing the rest; a saved workspace stays the one open only while it
    // still exists.
    const persisted = yield* readState;
    const explicitValid =
      initial !== null && initial.explicit
        ? yield* validOrNull(initial.path)
        : null;
    const persistedRoots =
      explicitValid === null ? yield* validRoots(persisted.roots) : [];
    const fallbackValid =
      explicitValid === null && persistedRoots.length === 0
        ? yield* validOrNull(
            initial !== null && !initial.explicit ? initial.path : null
          )
        : null;

    const initialRoots: ReadonlyArray<string> =
      explicitValid !== null
        ? [explicitValid]
        : persistedRoots.length > 0
          ? persistedRoots
          : fallbackValid !== null
            ? [fallbackValid]
            : [];
    const initialSaved =
      persistedRoots.length > 0 &&
      persisted.workspace !== null &&
      findWorkspace(persisted.workspace) !== undefined
        ? persisted.workspace
        : null;
    const recentsRef = yield* Ref.make<ReadonlyArray<OpenedRepo>>(
      persisted.recents
    );
    const savedIdRef = yield* Ref.make<string | null>(initialSaved);

    const remembersCurrent = explicitValid === null;

    const persist = Effect.gen(function* () {
      const onDisk = yield* readState;
      yield* writeState(
        remembersCurrent
          ? {
              current: getCurrentRepo(),
              roots: getOpenRoots(),
              workspace: yield* Ref.get(savedIdRef),
              recents: mergeOpened(yield* Ref.get(recentsRef), onDisk.recents),
            }
          : {
              ...onDisk,
              recents: mergeOpened(yield* Ref.get(recentsRef), onDisk.recents),
            }
      );
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

    const open = (roots: ReadonlyArray<string>, savedId: string | null) =>
      Effect.gen(function* () {
        yield* Effect.forEach(roots, adopt, { discard: true });
        yield* Ref.set(savedIdRef, savedId);
        // `current-repo.ts` is the single store for the roots: an Effect Ref
        // couldn't be read by the PTY socket / chat runtime, which run
        // outside the Effect runtime, so those (and this service) share the
        // one module snapshot.
        setOpenRoots(roots);
      });

    if (initialRoots.length > 0) yield* open(initialRoots, initialSaved);

    const roots: Effect.Effect<ReadonlyArray<string>> =
      Effect.sync(getOpenRoots);

    /**
     * Open roots side by side, each dated as just opened — the first last,
     * so the recents keep the workspace's order with its first at the top.
     */
    const openRoots: WorkspaceContextShape["openRoots"] = (next, savedId) =>
      Effect.gen(function* () {
        yield* open(next, savedId);
        const now = Date.now();
        const dated = next.map((path, index) => ({
          path,
          openedAt: new Date(now - index).toISOString(),
        }));
        yield* Ref.update(recentsRef, (existing) =>
          [
            ...dated,
            ...existing.filter((entry) => !next.includes(entry.path)),
          ].slice(0, MAX_RECENTS)
        );
        yield* persist;
      });

    return WorkspaceContext.of({
      home: homedir(),
      current: currentOf(roots),
      requireCurrent: requireCurrentOf(roots),
      roots,
      savedId: Ref.get(savedIdRef),
      recents: Effect.map(Ref.get(recentsRef), (recents) =>
        recents.map((entry) => entry.path)
      ),
      opened: Ref.get(recentsRef),
      selectRepo: (repo) => openRoots([repo], null),
      openRoots,
    });
  });

export const layer = (
  initial: InitialSelection | null
): Layer.Layer<
  WorkspaceContext,
  never,
  FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner
> => Layer.effect(WorkspaceContext)(make(initial));

/**
 * The workspace as seen from one repository: `root` reads as the open one,
 * while everything else — the recents, opening another — stays the real
 * context's. For a request that names the repository it is about instead of
 * following whatever the window has open, without touching the window.
 */
export const pinnedTo = (
  context: WorkspaceContextShape,
  root: string
): WorkspaceContextShape =>
  WorkspaceContext.of({
    ...context,
    current: Effect.succeed(root),
    requireCurrent: Effect.succeed(root),
  });

/**
 * Test seam: an in-memory context with no filesystem/git/persistence — a
 * repository open on its own, or several side by side.
 */
export const makeMemory = (
  initial: string | ReadonlyArray<string> | null = null
) =>
  Effect.gen(function* () {
    const initialRoots =
      initial === null ? [] : typeof initial === "string" ? [initial] : initial;
    const rootsRef = yield* Ref.make<ReadonlyArray<string>>(initialRoots);
    const savedIdRef = yield* Ref.make<string | null>(null);
    const recentsRef = yield* Ref.make<ReadonlyArray<OpenedRepo>>(
      initialRoots.map((path) => ({
        path,
        openedAt: "2026-01-01T00:00:00.000Z",
      }))
    );
    const roots = Ref.get(rootsRef);
    const openRoots: WorkspaceContextShape["openRoots"] = (next, savedId) =>
      Effect.gen(function* () {
        yield* Ref.set(rootsRef, next);
        yield* Ref.set(savedIdRef, savedId);
        yield* Ref.update(recentsRef, (existing) => [
          ...next.map((path) => ({
            path,
            openedAt: "2026-01-01T00:00:00.000Z",
          })),
          ...existing.filter((entry) => !next.includes(entry.path)),
        ]);
      });
    return WorkspaceContext.of({
      home: "/home/test",
      current: currentOf(roots),
      requireCurrent: requireCurrentOf(roots),
      roots,
      savedId: Ref.get(savedIdRef),
      recents: Effect.map(Ref.get(recentsRef), (recents) =>
        recents.map((entry) => entry.path)
      ),
      opened: Ref.get(recentsRef),
      selectRepo: (repo) => openRoots([repo], null),
      openRoots,
    });
  });

export const memoryLayer = (
  initial: string | ReadonlyArray<string> | null = null
): Layer.Layer<WorkspaceContext> =>
  Layer.effect(WorkspaceContext)(makeMemory(initial));
