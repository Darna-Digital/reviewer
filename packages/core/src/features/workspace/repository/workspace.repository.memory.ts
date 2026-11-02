import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import { NoRepoSelected, NotFound, StorageError } from "../../../shared.ts";
import { folderName } from "../functions/workspace.functions.ts";
import { mediaTypeFor } from "../schema/workspace.schema.ts";
import type {
  RepoEntry,
  RepoIndex,
  SavedWorkspace,
  WorkspaceInfo,
} from "../schema/workspace.schema.ts";
import type { WorkspaceRepo } from "./workspace.repository.ts";

export interface MemoryWorkspaceSeed {
  /** The open repository. */
  readonly project?: string | null;
  /** The repositories the machine holds, as the index would list them. */
  readonly repos?: ReadonlyArray<string>;
  /** Each repository's branch; `main` unless told otherwise. */
  readonly branches?: Record<string, string | null>;
  readonly recents?: ReadonlyArray<string>;
  readonly files?: Record<string, string>;
}
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Core stays platform-free, so the in-memory double encodes its own bytes. */
const toBase64 = (text: string) => {
  let out = "";
  for (let i = 0; i < text.length; i += 3) {
    const a = text.charCodeAt(i);
    const b = text.charCodeAt(i + 1);
    const c = text.charCodeAt(i + 2);
    out += BASE64_ALPHABET[a >> 2];
    out += BASE64_ALPHABET[((a & 3) << 4) | (Number.isNaN(b) ? 0 : b >> 4)];
    out += Number.isNaN(b)
      ? "="
      : BASE64_ALPHABET[((b & 15) << 2) | (Number.isNaN(c) ? 0 : c >> 6)];
    out += Number.isNaN(c) ? "=" : BASE64_ALPHABET[c & 63];
  }
  return out;
};

export const makeMemoryWorkspaceRepository = (seed: MemoryWorkspaceSeed = {}) =>
  Effect.gen(function* () {
    const branchOf = (path: string) => seed.branches?.[path] ?? "main";
    const indexed = (path: string): RepoEntry => ({
      name: folderName(path),
      path,
      branch: branchOf(path),
      lastOpened: null,
    });

    const currentRef = yield* Ref.make<string | null>(seed.project ?? null);
    const reposRef = yield* Ref.make<ReadonlyArray<RepoEntry>>(
      (seed.repos ?? []).map(indexed)
    );
    const recentsRef = yield* Ref.make<ReadonlyArray<string>>(
      seed.recents ?? []
    );
    const filesRef = yield* Ref.make<Record<string, string>>({ ...seed.files });
    const rootsRef = yield* Ref.make<ReadonlyArray<string>>(
      seed.project ? [seed.project] : []
    );
    const openSavedRef = yield* Ref.make<string | null>(null);
    const savedRef = yield* Ref.make<ReadonlyArray<SavedWorkspace>>([]);
    const nextId = yield* Ref.make(1);
    const requireCurrent = Ref.get(currentRef).pipe(
      Effect.flatMap((current) =>
        current === null ? Effect.fail(new NoRepoSelected()) : Effect.void
      )
    );
    const info: Effect.Effect<WorkspaceInfo> = Effect.gen(function* () {
      const current = yield* Ref.get(currentRef);
      const openSaved = yield* Ref.get(openSavedRef);
      const saved = (yield* Ref.get(savedRef)).find(
        (workspace) => workspace.id === openSaved
      );
      return {
        project: current,
        branch: current === null ? null : branchOf(current),
        roots: (yield* Ref.get(rootsRef)).map((path) => ({
          path,
          name: folderName(path),
          branch: branchOf(path),
        })),
        workspace: saved ? { id: saved.id, name: saved.name } : null,
        recents: yield* Ref.get(recentsRef),
        home: "/home/test",
      };
    });
    const openRoots = (roots: ReadonlyArray<string>, saved: string | null) =>
      Effect.gen(function* () {
        yield* Ref.set(rootsRef, roots);
        yield* Ref.set(currentRef, roots[0] ?? null);
        yield* Ref.set(openSavedRef, saved);
      });
    const findSaved = (id: string) =>
      Effect.flatMap(Ref.get(savedRef), (saved) => {
        const found = saved.find((workspace) => workspace.id === id);
        return found
          ? Effect.succeed(found)
          : Effect.fail(new NotFound({ reason: `no workspace ${id}` }));
      });
    const replaceSaved = (next: SavedWorkspace) =>
      Ref.update(savedRef, (saved) =>
        saved.map((workspace) => (workspace.id === next.id ? next : workspace))
      );
    const repos: Effect.Effect<RepoIndex> = Effect.gen(function* () {
      return {
        repos: yield* Ref.get(reposRef),
        scanning: false,
        scannedAt: null,
      };
    });
    const repo: WorkspaceRepo = {
      info,
      setCurrent: (path) =>
        Effect.gen(function* () {
          const openedAt = new Date(0).toISOString();
          yield* openRoots([path], null);
          yield* Ref.update(recentsRef, (existing) =>
            [path, ...existing.filter((recent) => recent !== path)].slice(0, 10)
          );
          yield* Ref.update(reposRef, (existing) =>
            existing.some((listed) => listed.path === path)
              ? existing.map((listed) =>
                  listed.path === path
                    ? { ...listed, lastOpened: openedAt }
                    : listed
                )
              : [...existing, { ...indexed(path), lastOpened: openedAt }]
          );
          return yield* info;
        }),
      setRoots: (roots) =>
        Effect.gen(function* () {
          const openSaved = yield* Ref.get(openSavedRef);
          if (openSaved !== null) {
            const saved = yield* findSaved(openSaved).pipe(Effect.orDie);
            yield* replaceSaved({ ...saved, roots });
          }
          yield* openRoots(roots, openSaved);
          return yield* info;
        }),
      workspaces: Ref.get(savedRef),
      createWorkspace: ({ name, roots }) =>
        Effect.gen(function* () {
          const id = `ws-${yield* Ref.getAndUpdate(nextId, (n) => n + 1)}`;
          const created: SavedWorkspace = {
            id,
            name,
            roots,
            createdAt: new Date(0).toISOString(),
            openedAt: null,
          };
          yield* Ref.update(savedRef, (saved) => [...saved, created]);
          return created;
        }),
      updateWorkspace: (id, patch) =>
        Effect.gen(function* () {
          const saved = yield* findSaved(id);
          const next = { ...saved, ...patch };
          yield* replaceSaved(next);
          if ((yield* Ref.get(openSavedRef)) === id) {
            yield* openRoots(next.roots, id);
          }
          return next;
        }),
      deleteWorkspace: (id) =>
        Effect.gen(function* () {
          yield* findSaved(id);
          yield* Ref.update(savedRef, (saved) =>
            saved.filter((workspace) => workspace.id !== id)
          );
          if ((yield* Ref.get(openSavedRef)) === id) {
            yield* Ref.set(openSavedRef, null);
          }
        }),
      openWorkspace: (id) =>
        Effect.gen(function* () {
          const saved = yield* findSaved(id);
          yield* replaceSaved({
            ...saved,
            openedAt: new Date(0).toISOString(),
          });
          yield* openRoots(saved.roots, id);
          return yield* info;
        }),
      repos,
      rescan: repos,
      browse: (path) =>
        Effect.succeed({
          path: path ?? "/home/test",
          parent: null,
          isGitRepo: false,
          entries: [],
        }),
      readFile: (relPath) =>
        Effect.gen(function* () {
          yield* requireCurrent;
          const files = yield* Ref.get(filesRef);
          const contents = files[relPath];
          if (contents === undefined) {
            return yield* Effect.fail(
              new StorageError({ reason: `no such file: ${relPath}` })
            );
          }
          return {
            name: relPath.split("/").at(-1) ?? relPath,
            contents,
            binary: false,
            sizeBytes: contents.length,
          };
        }),
      readFileBytes: (relPath) =>
        Effect.gen(function* () {
          const files = yield* Ref.get(filesRef);
          const contents = files[relPath];
          if (contents === undefined) {
            return yield* Effect.fail(
              new StorageError({ reason: `no such file: ${relPath}` })
            );
          }
          return {
            name: relPath.split("/").at(-1) ?? relPath,
            mediaType: mediaTypeFor(relPath),
            base64: toBase64(contents),
          };
        }),
      writeFile: (relPath, contents) =>
        Ref.update(filesRef, (files) => ({ ...files, [relPath]: contents })),
      revealPath: (relPath) =>
        Effect.gen(function* () {
          yield* requireCurrent;
          const files = yield* Ref.get(filesRef);
          // The double has no directory of its own: a folder is whatever the
          // seeded files spell, so a path is there if it is a file or holds one.
          const held =
            files[relPath] !== undefined ||
            Object.keys(files).some((path) => path.startsWith(`${relPath}/`));
          if (!held) {
            return yield* Effect.fail(
              new StorageError({ reason: `no such path: ${relPath}` })
            );
          }
        }),
    };
    return repo;
  });
