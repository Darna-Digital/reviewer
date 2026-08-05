import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import { NoRepoSelected, StorageError } from "../../../shared.ts";
import { mediaTypeFor } from "../schema/workspace.schema.ts";
import type { WorkspaceInfo } from "../schema/workspace.schema.ts";
import type { WorkspaceRepo } from "./workspace.repository.ts";

export interface MemoryWorkspaceSeed {
  readonly current?: string | null;
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
    const currentRef = yield* Ref.make<string | null>(seed.current ?? null);
    const recentsRef = yield* Ref.make<ReadonlyArray<string>>(
      seed.recents ?? []
    );
    const filesRef = yield* Ref.make<Record<string, string>>({ ...seed.files });
    const infoFrom = (
      current: string | null,
      recents: ReadonlyArray<string>
    ): WorkspaceInfo => ({
      current,
      recents,
      home: "/home/test",
      isGitRepo: current !== null,
      childRepos: [],
    });
    const repo: WorkspaceRepo = {
      info: Effect.gen(function* () {
        return infoFrom(yield* Ref.get(currentRef), yield* Ref.get(recentsRef));
      }),
      setCurrent: (path) =>
        Effect.gen(function* () {
          yield* Ref.set(currentRef, path);
          const recents = yield* Ref.updateAndGet(recentsRef, (existing) =>
            [path, ...existing.filter((entry) => entry !== path)].slice(0, 10)
          );
          return infoFrom(path, recents);
        }),
      browse: (path) =>
        Effect.succeed({
          path: path ?? "/home/test",
          parent: null,
          isGitRepo: false,
          entries: [],
        }),
      readFile: (relPath) =>
        Effect.gen(function* () {
          yield* Ref.get(currentRef).pipe(
            Effect.flatMap((current) =>
              current === null ? Effect.fail(new NoRepoSelected()) : Effect.void
            )
          );
          const files = yield* Ref.get(filesRef);
          const contents = files[relPath];
          if (contents === undefined) {
            return yield* Effect.fail(
              new StorageError({ reason: `no such file: ${relPath}` })
            );
          }
          return { name: relPath.split("/").at(-1) ?? relPath, contents };
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
      deletePath: (relPath) =>
        Ref.update(filesRef, (files) => {
          const next = { ...files };
          delete next[relPath];
          return next;
        }),
      renamePath: (fromRel, toRel) =>
        Ref.update(filesRef, (files) => {
          const next = { ...files };
          const value = next[fromRel];
          if (value !== undefined) {
            delete next[fromRel];
            next[toRel] = value;
          }
          return next;
        }),
    };
    return repo;
  });
