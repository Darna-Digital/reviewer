import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import { NoRepoSelected, StorageError } from "../../../shared.ts";
import { InvalidRepo, PathExists } from "../errors.ts";
import { chooseRepo, repoName } from "../functions/workspace.functions.ts";
import { mediaTypeFor } from "../schema/workspace.schema.ts";
import type { RepoEntry, WorkspaceInfo } from "../schema/workspace.schema.ts";
import type { WorkspaceRepo } from "./workspace.repository.ts";

export interface MemoryWorkspaceSeed {
  /** The open project folder. */
  readonly project?: string | null;
  /** The git roots it holds; a project with none listed holds only itself. */
  readonly repos?: ReadonlyArray<string>;
  /** The active root; defaults to the project's first. */
  readonly current?: string | null;
  /** Per-root branches, for the cases where the roots have drifted apart. */
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
    const project = seed.project ?? null;
    /** The roots the seeded folder holds — itself, unless told otherwise. */
    const reposUnder = (folder: string): ReadonlyArray<RepoEntry> => {
      const held = (seed.repos ?? []).filter(
        (path) => path === folder || path.startsWith(`${folder}/`)
      );
      const paths = held.length > 0 ? held : [folder];
      return paths.map((path) => ({
        name: repoName(folder, path),
        path,
        branch: seed.branches?.[path] ?? "main",
      }));
    };

    const projectRef = yield* Ref.make<string | null>(project);
    const reposRef = yield* Ref.make<ReadonlyArray<RepoEntry>>(
      project === null ? [] : reposUnder(project)
    );
    const currentRef = yield* Ref.make<string | null>(
      seed.current ??
        (project === null ? null : chooseRepo(reposUnder(project), null))
    );
    const recentsRef = yield* Ref.make<ReadonlyArray<string>>(
      seed.recents ?? []
    );
    const filesRef = yield* Ref.make<Record<string, string>>({ ...seed.files });
    const directoriesRef = yield* Ref.make<ReadonlyArray<string>>([]);
    const requireCurrent = Ref.get(currentRef).pipe(
      Effect.flatMap((current) =>
        current === null ? Effect.fail(new NoRepoSelected()) : Effect.void
      )
    );
    const info: Effect.Effect<WorkspaceInfo> = Effect.gen(function* () {
      return {
        project: yield* Ref.get(projectRef),
        repos: yield* Ref.get(reposRef),
        current: yield* Ref.get(currentRef),
        recents: yield* Ref.get(recentsRef),
        home: "/home/test",
        device: "Test Machine",
      };
    });
    const repo: WorkspaceRepo = {
      info,
      setCurrent: (path) =>
        Effect.gen(function* () {
          const repos = reposUnder(path);
          yield* Ref.set(projectRef, path);
          yield* Ref.set(reposRef, repos);
          yield* Ref.set(currentRef, chooseRepo(repos, null));
          yield* Ref.update(recentsRef, (existing) =>
            [path, ...existing.filter((entry) => entry !== path)].slice(0, 10)
          );
          return yield* info;
        }),
      selectRepo: (path) =>
        Effect.gen(function* () {
          const repos = yield* Ref.get(reposRef);
          if (!repos.some((entry) => entry.path === path)) {
            return yield* Effect.fail(
              new InvalidRepo({
                path,
                reason: "not a repository in this project",
              })
            );
          }
          yield* Ref.set(currentRef, path);
          return yield* info;
        }),
      browse: (path) =>
        Effect.succeed({
          path: path ?? "/home/test",
          parent: null,
          isGitRepo: false,
          repoCount: 0,
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
      createPath: (relPath, kind) =>
        Effect.gen(function* () {
          yield* requireCurrent;
          const files = yield* Ref.get(filesRef);
          const directories = yield* Ref.get(directoriesRef);
          const taken =
            files[relPath] !== undefined ||
            directories.includes(relPath) ||
            Object.keys(files).some((path) => path.startsWith(`${relPath}/`));
          if (taken) {
            return yield* Effect.fail(new PathExists({ path: relPath }));
          }
          yield* kind === "directory"
            ? Ref.update(directoriesRef, (dirs) => [...dirs, relPath])
            : Ref.update(filesRef, (existing) => ({
                ...existing,
                [relPath]: "",
              }));
        }),
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
