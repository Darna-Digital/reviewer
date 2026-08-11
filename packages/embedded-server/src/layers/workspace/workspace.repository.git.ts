/**
 * Git/filesystem-backed workspace repository — the real implementation, the
 * darna-stack ".db" equivalent. Owns opening a project (a folder, which may
 * hold several git roots), moving between those roots, browsing the filesystem
 * and file IO, mapping platform errors to StorageError.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import type { PlatformError } from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/unstable/process";
import { homedir } from "node:os";
import { resolve as pathResolve } from "node:path";
import { NoRepoSelected, StorageError } from "@byconvo/core/shared";
import { InvalidRepo, mediaTypeFor, PathExists } from "@byconvo/core/workspace";
import { countRepos, isGitRoot, scanRepos } from "./repo-scan.ts";
import { resolveWorkspace, WorkspaceContext } from "./workspace-context.ts";
import type {
  BrowseEntry,
  BrowsePayload,
  WorkspaceInfo,
  WorkspaceRepo,
} from "@byconvo/core/workspace";

const toStorageError = (error: PlatformError) =>
  new StorageError({ reason: error.message });

export const makeGitWorkspaceRepository = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const ctx = yield* WorkspaceContext;

  const tryFs = <A, R>(effect: Effect.Effect<A, PlatformError, R>) =>
    effect.pipe(Effect.mapError(toStorageError));

  /** The open project as the SPA sees it: its roots, rescanned on every read
   * so a repository cloned into the folder shows up without reopening it. */
  const info: WorkspaceRepo["info"] = Effect.gen(function* () {
    const project = yield* ctx.project;
    return {
      project,
      repos: project === null ? [] : yield* scanRepos(fs, project),
      current: yield* ctx.current,
      recents: yield* ctx.recents,
      home: homedir(),
    } satisfies WorkspaceInfo;
  });

  const setCurrent: WorkspaceRepo["setCurrent"] = (path) =>
    Effect.gen(function* () {
      const root = yield* resolveWorkspace(fs, spawner, path).pipe(
        Effect.mapError(toStorageError)
      );
      if (root === null) {
        return yield* Effect.fail(
          new InvalidRepo({ path, reason: "not a directory" })
        );
      }
      yield* ctx.selectProject(root);
      return yield* info;
    });

  const selectRepo: WorkspaceRepo["selectRepo"] = (path) =>
    Effect.gen(function* () {
      const project = yield* ctx.project;
      if (project === null) {
        return yield* Effect.fail(
          new InvalidRepo({ path, reason: "no project is open" })
        );
      }
      const repos = yield* scanRepos(fs, project);
      if (!repos.some((repo) => repo.path === path)) {
        return yield* Effect.fail(
          new InvalidRepo({
            path,
            reason: "not a repository in the open project",
          })
        );
      }
      yield* ctx.selectRepo(path);
      return yield* info;
    });

  const browse: WorkspaceRepo["browse"] = (requested) =>
    Effect.gen(function* () {
      const path = requested ?? homedir();
      const names = yield* tryFs(fs.readDirectory(path));
      const entries: Array<BrowseEntry> = [];
      for (const name of [...names].sort((a, b) => a.localeCompare(b))) {
        if (name.startsWith(".") || name === "node_modules") continue;
        const childPath = `${path}/${name}`;
        const stat = yield* fs
          .stat(childPath)
          .pipe(Effect.catch(() => Effect.succeed(null)));
        if (stat === null || stat.type !== "Directory") continue;
        const isRepo = yield* isGitRoot(fs, childPath);
        // A folder of repositories is openable too, so the picker has to be
        // able to tell one from an ordinary directory before you step into it.
        entries.push({
          name,
          path: childPath,
          isGitRepo: isRepo,
          repoCount: isRepo ? 1 : yield* countRepos(fs, childPath),
        });
      }
      const parent =
        path === "/" ? null : path.slice(0, path.lastIndexOf("/")) || "/";
      const isRepo = yield* isGitRoot(fs, path);
      return {
        path,
        parent,
        isGitRepo: isRepo,
        repoCount: isRepo ? 1 : yield* countRepos(fs, path),
        entries,
      } satisfies BrowsePayload;
    });

  /** Resolve a repo-relative path, refusing anything that escapes the root. */
  const resolveInRepo = (relPath: string) =>
    Effect.gen(function* () {
      const root = yield* ctx.requireCurrent;
      const cleaned = relPath.replace(/^\/+/, "");
      const resolved = pathResolve(`${root}/${cleaned}`);
      if (resolved !== root && !resolved.startsWith(`${root}/`)) {
        return yield* Effect.fail(new NoRepoSelected());
      }
      return { resolved, name: cleaned.split("/").at(-1) ?? cleaned };
    });

  const readFile: WorkspaceRepo["readFile"] = (relPath) =>
    Effect.gen(function* () {
      const { name, resolved } = yield* resolveInRepo(relPath);
      const contents = yield* tryFs(fs.readFileString(resolved));
      return { name, contents };
    });

  const readFileBytes: WorkspaceRepo["readFileBytes"] = (relPath) =>
    Effect.gen(function* () {
      const { name, resolved } = yield* resolveInRepo(relPath);
      const bytes = yield* tryFs(fs.readFile(resolved));
      return {
        name,
        mediaType: mediaTypeFor(relPath),
        base64: Buffer.from(bytes).toString("base64"),
      };
    });

  const makeParentDirectory = (resolved: string) => {
    const parent = resolved.slice(0, resolved.lastIndexOf("/"));
    return parent.length > 0
      ? tryFs(fs.makeDirectory(parent, { recursive: true }))
      : Effect.void;
  };

  const writeFile: WorkspaceRepo["writeFile"] = (relPath, contents) =>
    Effect.gen(function* () {
      const { resolved } = yield* resolveInRepo(relPath);
      yield* tryFs(fs.writeFileString(resolved, contents));
    });

  const createPath: WorkspaceRepo["createPath"] = (relPath, kind) =>
    Effect.gen(function* () {
      const { resolved } = yield* resolveInRepo(relPath);
      if (yield* tryFs(fs.exists(resolved))) {
        return yield* Effect.fail(new PathExists({ path: relPath }));
      }
      if (kind === "directory") {
        return yield* tryFs(fs.makeDirectory(resolved, { recursive: true }));
      }
      yield* makeParentDirectory(resolved);
      yield* tryFs(fs.writeFileString(resolved, ""));
    });

  const deletePath: WorkspaceRepo["deletePath"] = (relPath) =>
    Effect.gen(function* () {
      const { resolved } = yield* resolveInRepo(relPath);
      yield* tryFs(fs.remove(resolved, { recursive: true }));
    });

  const renamePath: WorkspaceRepo["renamePath"] = (fromRel, toRel) =>
    Effect.gen(function* () {
      const from = yield* resolveInRepo(fromRel);
      const to = yield* resolveInRepo(toRel);
      yield* makeParentDirectory(to.resolved);
      yield* tryFs(fs.rename(from.resolved, to.resolved));
    });

  return {
    info,
    setCurrent,
    selectRepo,
    browse,
    readFile,
    readFileBytes,
    writeFile,
    createPath,
    deletePath,
    renamePath,
  } satisfies WorkspaceRepo;
});
