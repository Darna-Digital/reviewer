import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import { NoRepoSelected, StorageError } from "../../../shared.ts";
import { folderName } from "../functions/workspace.functions.ts";
import { mediaTypeFor } from "../schema/workspace.schema.ts";
import type {
  RepoEntry,
  RepoIndex,
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
    const requireCurrent = Ref.get(currentRef).pipe(
      Effect.flatMap((current) =>
        current === null ? Effect.fail(new NoRepoSelected()) : Effect.void
      )
    );
    const info: Effect.Effect<WorkspaceInfo> = Effect.gen(function* () {
      const current = yield* Ref.get(currentRef);
      return {
        project: current,
        branch: current === null ? null : branchOf(current),
        recents: yield* Ref.get(recentsRef),
        home: "/home/test",
      };
    });
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
          yield* Ref.set(currentRef, path);
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
