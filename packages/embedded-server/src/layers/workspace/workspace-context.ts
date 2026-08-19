/**
 * WorkspaceContext — the mutable "what is open" state, shared across features
 * (Git exec, comments, GitHub all read the current repo from here). It is the
 * server's analogue of a database connection in the darna-stack: a single infra
 * service the feature repositories build on.
 *
 * Two things are open at once. The **project** is the folder the user picked;
 * it may be a repository itself or a parent holding several side by side. The
 * **current repo** is the one git runs in — always one of the project's roots.
 * For a single-repo project the two are the same path, which is why every
 * repo-scoped feature keeps working untouched.
 *
 * Both are persisted to ~/.byconvo/state.json, together with a recents list of
 * projects and the root each project was last left on, and seeded at boot from
 * BYCONVO_REPO / cwd. Only primitives (paths) cross this boundary — domain
 * shapes live in the workspace feature's schema.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { homedir } from "node:os";
import { resolve as pathResolve } from "node:path";
import { NoRepoSelected } from "@byconvo/core/shared";
import { chooseRepo, InvalidRepo } from "@byconvo/core/workspace";
import type { RepoEntry } from "@byconvo/core/workspace";
import { importLegacyJson } from "../db/legacy-import.ts";
import { rememberProject } from "../db/scope.ts";
import {
  getCurrentProject,
  getCurrentRepo,
  setCurrentProject,
  setCurrentRepo,
} from "./current-repo.ts";
import { scanRepos, worktreesOf } from "./repo-scan.ts";

export interface WorkspaceContextShape {
  /** The selected repo root, or fail with NoRepoSelected when none is set. */
  readonly requireCurrent: Effect.Effect<string, NoRepoSelected>;
  /** The selected repo root, or null when the project holds none. */
  readonly current: Effect.Effect<string | null>;
  /** The open project folder, or null when nothing is open. */
  readonly project: Effect.Effect<string | null>;
  /** The open project folder, or fail with NoRepoSelected when none is. */
  readonly requireProject: Effect.Effect<string, NoRepoSelected>;
  /** Recently opened projects, most-recent first. */
  readonly recents: Effect.Effect<ReadonlyArray<string>>;
  /**
   * Open an already-resolved folder as the project: its roots are discovered,
   * the one it was last left on (or its first) becomes current, and both are
   * persisted. Returns the root that ended up current — null for a folder
   * holding none.
   */
  readonly selectProject: (project: string) => Effect.Effect<string | null>;
  /** Point the git views at one of the open project's roots, and remember it. */
  readonly selectRepo: (repo: string) => Effect.Effect<void>;
  /** The user's home directory (for the picker's default browse root). */
  readonly home: string;
}

export class WorkspaceContext extends Context.Service<
  WorkspaceContext,
  WorkspaceContextShape
>()("WorkspaceContext") {}

const STATE_DIR = `${homedir()}/.byconvo`;
const STATE_FILE = `${STATE_DIR}/state.json`;
const MAX_RECENTS = 10;

interface PersistedState {
  /** The open project folder. */
  readonly current: string | null;
  /** Recently opened projects, most-recent first. */
  readonly recents: ReadonlyArray<string>;
  /** The root each project was last left on, keyed by project path. */
  readonly repos: Readonly<Record<string, string>>;
}

export interface InitialSelection {
  readonly path: string;
  /** Explicit (BYCONVO_REPO) beats persisted state; a cwd guess does not. */
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
 * Canonical workspace path for `path`: the git root if it (or an ancestor) is a
 * repo, otherwise the directory itself. Null when it isn't a directory.
 */
export const resolveWorkspace = (
  fs: FileSystem.FileSystem,
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"],
  path: string
) =>
  Effect.gen(function* () {
    const stat = yield* fs
      .stat(path)
      .pipe(Effect.catch(() => Effect.succeed(null)));
    if (stat === null || stat.type !== "Directory") return null;
    const root = yield* validateRepo(spawner, path).pipe(
      Effect.catch(() => Effect.succeed(null))
    );
    return root ?? pathResolve(path);
  });

export const make = (initial: InitialSelection | null) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    const EMPTY_STATE: PersistedState = {
      current: null,
      recents: [],
      repos: {},
    };

    // State written before projects existed has no `repos` map; its `current`
    // was a repository, which is a project holding exactly itself, so it reads
    // back correctly with nothing to migrate.
    const readState: Effect.Effect<PersistedState> = Effect.gen(function* () {
      const present = yield* fs.exists(STATE_FILE);
      if (!present) return EMPTY_STATE;
      const raw = yield* fs.readFileString(STATE_FILE);
      try {
        const parsed = JSON.parse(raw);
        const repos =
          typeof parsed?.repos === "object" && parsed.repos !== null
            ? Object.fromEntries(
                Object.entries(parsed.repos as Record<string, unknown>).filter(
                  (entry): entry is [string, string] =>
                    typeof entry[1] === "string"
                )
              )
            : {};
        return {
          current: typeof parsed?.current === "string" ? parsed.current : null,
          recents: Array.isArray(parsed?.recents)
            ? parsed.recents.filter(
                (entry: unknown): entry is string => typeof entry === "string"
              )
            : [],
          repos,
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
      path === null
        ? Effect.succeed(null)
        : resolveWorkspace(fs, spawner, path);

    // Boot order: explicit BYCONVO_REPO > last workspace used > cwd guess.
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

    const initialProject = explicitValid ?? persistedValid ?? fallbackValid;
    const recentsRef = yield* Ref.make<ReadonlyArray<string>>(
      persisted.recents
    );
    const rememberedRef = yield* Ref.make<Readonly<Record<string, string>>>(
      persisted.repos
    );

    /** Persist whatever is open now, alongside recents and the per-project roots. */
    const persist = Effect.gen(function* () {
      yield* writeState({
        current: getCurrentProject(),
        recents: yield* Ref.get(recentsRef),
        repos: yield* Ref.get(rememberedRef),
      });
    });

    /**
     * Register the project and every root it holds, and take across anything
     * those roots still keep in `.byconvo/*.json`.
     *
     * Both are per-root on purpose: a folder holding a `backend` and a
     * `frontend` is one project made of two repositories, and each of them
     * carries its own history. Neither call fails an open — a project that
     * cannot be recorded is still a project the user can work in.
     */
    const adoptRoots = (
      project: string,
      roots: ReadonlyArray<RepoEntry>,
      worktrees: ReadonlyArray<RepoEntry>
    ) =>
      Effect.sync(() => {
        try {
          // Worktrees are registered alongside the roots, though they are not
          // roots. This table is only what files a path under the project it
          // belongs to, and anything written while standing in a worktree — a
          // session above all — is written against the worktree's own path. Left
          // out, those would be filed under a project of their own, named after
          // a directory the user never opened.
          rememberProject(project, [...roots, ...worktrees]);
          for (const repo of roots) importLegacyJson(repo.path);
        } catch (error) {
          console.warn(
            "byconvo: could not register the open project —",
            error instanceof Error ? error.message : error
          );
        }
      });

    /** Open `project` where it was last left, or on its first root. */
    const openRoots = (project: string) =>
      Effect.gen(function* () {
        const roots = yield* scanRepos(fs, project);
        const worktrees = yield* worktreesOf(fs, roots);
        yield* adoptRoots(project, roots, worktrees);
        const remembered = yield* Ref.get(rememberedRef);
        // Chosen from the worktrees rather than the roots: a project left in
        // one of them should reopen there, and matching only against roots
        // would forget the worktree and land you in the original checkout —
        // a different working tree than the one the work is in.
        const chosen = chooseRepo(
          [...roots, ...worktrees],
          remembered[project] ?? null
        );
        // `current-repo.ts` is the single store for the selection: an Effect Ref
        // couldn't be read by the PTY socket / chat runtime, which run outside
        // the Effect runtime, so those (and this service) share the one module
        // snapshot. The project moves first so a listener woken by the repo
        // change already sees the project it belongs to.
        setCurrentProject(project);
        setCurrentRepo(chosen);
        return chosen;
      });

    if (initialProject !== null) yield* openRoots(initialProject);

    const current: Effect.Effect<string | null> = Effect.sync(getCurrentRepo);
    const project: Effect.Effect<string | null> =
      Effect.sync(getCurrentProject);

    const selectProject: WorkspaceContextShape["selectProject"] = (root) =>
      Effect.gen(function* () {
        const chosen = yield* openRoots(root);
        yield* Ref.update(recentsRef, (existing) =>
          [root, ...existing.filter((entry) => entry !== root)].slice(
            0,
            MAX_RECENTS
          )
        );
        if (chosen !== null) {
          yield* Ref.update(rememberedRef, (existing) => ({
            ...existing,
            [root]: chosen,
          }));
        }
        yield* persist;
        return chosen;
      });

    const selectRepo: WorkspaceContextShape["selectRepo"] = (repo) =>
      Effect.gen(function* () {
        setCurrentRepo(repo);
        const open = getCurrentProject();
        if (open !== null) {
          yield* Ref.update(rememberedRef, (existing) => ({
            ...existing,
            [open]: repo,
          }));
        }
        yield* persist;
      });

    const orNoSelection = (path: Effect.Effect<string | null>) =>
      path.pipe(
        Effect.flatMap((selected) =>
          selected === null
            ? Effect.fail(new NoRepoSelected())
            : Effect.succeed(selected)
        )
      );

    return WorkspaceContext.of({
      home: homedir(),
      current,
      project,
      recents: Ref.get(recentsRef),
      requireCurrent: orNoSelection(current),
      requireProject: orNoSelection(project),
      selectProject,
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

/**
 * Test seam: an in-memory context with no filesystem/git/persistence. The
 * seeded folder stands in for a single-repo project, where the project and the
 * current root are the same path.
 */
export const makeMemory = (initial: string | null = null) =>
  Effect.gen(function* () {
    const projectRef = yield* Ref.make<string | null>(initial);
    const currentRef = yield* Ref.make<string | null>(initial);
    const recentsRef = yield* Ref.make<ReadonlyArray<string>>(
      initial === null ? [] : [initial]
    );
    const orNoSelection = (path: Effect.Effect<string | null>) =>
      path.pipe(
        Effect.flatMap((selected) =>
          selected === null
            ? Effect.fail(new NoRepoSelected())
            : Effect.succeed(selected)
        )
      );
    return WorkspaceContext.of({
      home: "/home/test",
      current: Ref.get(currentRef),
      project: Ref.get(projectRef),
      recents: Ref.get(recentsRef),
      requireCurrent: orNoSelection(Ref.get(currentRef)),
      requireProject: orNoSelection(Ref.get(projectRef)),
      selectProject: (root) =>
        Effect.gen(function* () {
          yield* Ref.set(projectRef, root);
          yield* Ref.set(currentRef, root);
          yield* Ref.update(recentsRef, (existing) => [
            root,
            ...existing.filter((entry) => entry !== root),
          ]);
          return root;
        }),
      selectRepo: (repo) => Ref.set(currentRef, repo),
    });
  });

export const memoryLayer = (
  initial: string | null = null
): Layer.Layer<WorkspaceContext> =>
  Layer.effect(WorkspaceContext)(makeMemory(initial));
