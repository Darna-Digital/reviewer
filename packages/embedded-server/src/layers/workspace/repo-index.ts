/**
 * RepoIndex — every git repository the machine holds, for the opener to list.
 *
 * The walk over the home folder takes seconds, so the index is kept: the
 * last complete listing is written to ~/.reviewer/repos.json and read back at
 * boot, and a fresh walk starts in the background — at boot, and whenever a
 * client asks — filling the listing in as it goes. What a read returns is
 * the walk's progress so far folded with the repositories opened here, each
 * stamped with its last open, so a repository the walk has not reached (or
 * one outside the home folder) still lists once it has been opened.
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import { homedir } from "node:os";
import {
  mergeRepos,
  type RepoEntry,
  type RepoIndex,
} from "@reviewer/core/workspace";
import { isGitRoot, scanRepos } from "./repo-scan.ts";
import { WorkspaceContext } from "./workspace-context.ts";

export interface RepoIndexShape {
  /** The listing as it stands, and whether a walk is still filling it in. */
  readonly read: Effect.Effect<RepoIndex>;
  /** Start a walk unless one is under way, and answer with the listing now. */
  readonly rescan: Effect.Effect<RepoIndex>;
}

export class RepoIndexService extends Context.Service<
  RepoIndexService,
  RepoIndexShape
>()("RepoIndexService") {}

const CACHE_FILE = `${homedir()}/.reviewer/repos.json`;

interface Cached {
  readonly repos: ReadonlyArray<RepoEntry>;
  readonly scannedAt: string | null;
}

const EMPTY: Cached = { repos: [], scannedAt: null };

const isEntry = (value: unknown): value is RepoEntry =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as RepoEntry).path === "string" &&
  typeof (value as RepoEntry).name === "string";

export const make = (start: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const ctx = yield* WorkspaceContext;

    const readCache: Effect.Effect<Cached> = Effect.gen(function* () {
      if (!(yield* fs.exists(CACHE_FILE))) return EMPTY;
      const parsed = JSON.parse(yield* fs.readFileString(CACHE_FILE));
      return {
        repos: Array.isArray(parsed?.repos)
          ? parsed.repos.filter(isEntry).map((repo: RepoEntry): RepoEntry => ({
              name: repo.name,
              path: repo.path,
              branch: typeof repo.branch === "string" ? repo.branch : null,
              lastOpened: null,
            }))
          : [],
        scannedAt:
          typeof parsed?.scannedAt === "string" ? parsed.scannedAt : null,
      };
    }).pipe(Effect.catch(() => Effect.succeed(EMPTY)));

    const writeCache = (cached: Cached) =>
      Effect.gen(function* () {
        yield* fs.makeDirectory(`${homedir()}/.reviewer`, { recursive: true });
        yield* fs.writeFileString(CACHE_FILE, JSON.stringify(cached, null, 2));
      }).pipe(Effect.catch(() => Effect.void));

    const settled = yield* Ref.make<Cached>(yield* readCache);
    /** What the walk under way has found so far; null between walks. */
    const inFlight = yield* Ref.make<ReadonlyArray<RepoEntry> | null>(null);

    const read: Effect.Effect<RepoIndex> = Effect.gen(function* () {
      const cached = yield* Ref.get(settled);
      const walking = yield* Ref.get(inFlight);
      // A walk in progress lists what it has reached over what the last one
      // settled on, so the listing never empties while it refreshes; a
      // repository that is gone drops out once the walk settles.
      const scanned =
        walking === null
          ? cached.repos
          : [
              ...walking,
              ...cached.repos.filter(
                (repo) => !walking.some((found) => found.path === repo.path)
              ),
            ];
      // An open remembered from before is listed only while it is still a
      // repository: a folder that was opened as a project of several roots,
      // or one deleted since, has nothing to open.
      const opened = yield* Effect.filter(
        yield* ctx.opened,
        (entry) => isGitRoot(entry.path),
        { concurrency: 8 }
      );
      return {
        repos: mergeRepos(scanned, opened),
        scanning: walking !== null,
        scannedAt: cached.scannedAt,
      };
    });

    const walk = Effect.gen(function* () {
      yield* Ref.set(inFlight, []);
      yield* scanRepos(start, (repo) =>
        Ref.update(inFlight, (found) => [...(found ?? []), repo])
      );
      const found = (yield* Ref.get(inFlight)) ?? [];
      const cached: Cached = {
        repos: mergeRepos(found, []),
        scannedAt: new Date().toISOString(),
      };
      yield* Ref.set(settled, cached);
      yield* Ref.set(inFlight, null);
      yield* writeCache(cached);
    }).pipe(Effect.catch(() => Ref.set(inFlight, null)));

    const rescan: Effect.Effect<RepoIndex> = Effect.gen(function* () {
      if ((yield* Ref.get(inFlight)) === null) {
        yield* Effect.forkDetach(walk, { startImmediately: true });
      }
      return yield* read;
    });

    yield* rescan;

    return RepoIndexService.of({ read, rescan });
  });

export const layer = (
  start: string = homedir()
): Layer.Layer<
  RepoIndexService,
  never,
  FileSystem.FileSystem | WorkspaceContext
> => Layer.effect(RepoIndexService)(make(start));

/** Test seam: a fixed listing, never scanning. */
export const memoryLayer = (
  repos: ReadonlyArray<RepoEntry> = []
): Layer.Layer<RepoIndexService> =>
  Layer.succeed(RepoIndexService)(
    RepoIndexService.of({
      read: Effect.succeed({ repos, scanning: false, scannedAt: null }),
      rescan: Effect.succeed({ repos, scanning: false, scannedAt: null }),
    })
  );
