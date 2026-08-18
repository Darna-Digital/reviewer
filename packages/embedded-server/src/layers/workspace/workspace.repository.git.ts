/**
 * Git/filesystem-backed workspace repository — the real implementation, the
 * darna-stack ".db" equivalent. Owns opening a project (a folder, which may
 * hold several git roots), moving between those roots, browsing the filesystem
 * and file IO, mapping platform errors to StorageError.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import type { PlatformError } from "effect/PlatformError";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { homedir, hostname } from "node:os";
import { resolve as pathResolve } from "node:path";
import { NoRepoSelected, StorageError } from "@byconvo/core/shared";
import { InvalidRepo, mediaTypeFor, PathExists } from "@byconvo/core/workspace";
import { mainRepoOf } from "./main-repo.ts";
import {
  countRepos,
  isGitRoot,
  scanRepos,
  scanWorktrees,
} from "./repo-scan.ts";
import { resolveWorkspace, WorkspaceContext } from "./workspace-context.ts";
import type {
  BrowseEntry,
  BrowsePayload,
  WorkspaceInfo,
  WorkspaceRepo,
} from "@byconvo/core/workspace";

const toStorageError = (error: PlatformError) =>
  new StorageError({ reason: error.message });

// Git's own heuristic: a NUL byte in the first 8k means "not text".
const BINARY_SNIFF_BYTES = 8000;
const looksBinary = (bytes: Uint8Array) =>
  bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);

/** `laptop.local`, `laptop.lan` — network dressing on an otherwise fine name. */
const stripHostSuffix = (host: string) => host.split(".")[0] ?? host;

/**
 * What the machine calls itself. On macOS that is the name its owner typed in
 * Settings — "Ada's MacBook Pro" — which the hostname only ever carries as a
 * hyphenated, `.local` version of itself; elsewhere the hostname is the name.
 */
const readDeviceName = (
  spawner: ChildProcessSpawner.ChildProcessSpawner["Service"]
) =>
  Effect.gen(function* () {
    const fallback = stripHostSuffix(hostname());
    if (process.platform !== "darwin") return fallback;
    const named = yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner.spawn(
          ChildProcess.make("scutil", ["--get", "ComputerName"])
        );
        const [stdout, exitCode] = yield* Effect.all([
          Stream.mkString(Stream.decodeText(handle.stdout)),
          handle.exitCode,
        ]);
        return exitCode === 0 ? stdout.trim() : "";
      })
    ).pipe(Effect.catchCause(() => Effect.succeed("")));
    return named === "" ? fallback : named;
  });

export const makeGitWorkspaceRepository = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const ctx = yield* WorkspaceContext;
  const device = yield* readDeviceName(spawner);

  const tryFs = <A, R>(effect: Effect.Effect<A, PlatformError, R>) =>
    effect.pipe(Effect.mapError(toStorageError));

  /** The open project as the SPA sees it: its roots, rescanned on every read
   * so a repository cloned into the folder shows up without reopening it. */
  const info: WorkspaceRepo["info"] = Effect.gen(function* () {
    const project = yield* ctx.project;
    const current = yield* ctx.current;
    return {
      project,
      repos: project === null ? [] : yield* scanRepos(fs, project),
      current,
      currentRoot: current === null ? null : yield* mainRepoOf(fs, current),
      recents: yield* ctx.recents,
      home: homedir(),
      device,
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
      // Worktrees, not roots: a task's worktree is somewhere the app can be
      // pointed even though it is not one of the repositories the project holds.
      const worktrees = yield* scanWorktrees(fs, project);
      if (!worktrees.some((worktree) => worktree.path === path)) {
        return yield* Effect.fail(
          new InvalidRepo({
            path,
            reason: "not a worktree of the open project",
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

  /**
   * Resolve a path the views use against the project root, refusing anything
   * that escapes it.
   *
   * The project root, not the selected repository: paths are named from the
   * project (`web-app/src/a.ts`), so a file in any of its roots opens without
   * anything being switched first. A project holding one repository has the
   * two roots at the same path, so this is exactly what it always did.
   */
  const resolveInProject = (relPath: string) =>
    Effect.gen(function* () {
      const root = yield* ctx.requireProject;
      const cleaned = relPath.replace(/^\/+/, "");
      const resolved = pathResolve(`${root}/${cleaned}`);
      if (resolved !== root && !resolved.startsWith(`${root}/`)) {
        return yield* Effect.fail(new NoRepoSelected());
      }
      return { resolved, name: cleaned.split("/").at(-1) ?? cleaned };
    });

  const readFile: WorkspaceRepo["readFile"] = (relPath) =>
    Effect.gen(function* () {
      const { name, resolved } = yield* resolveInProject(relPath);
      const bytes = yield* tryFs(fs.readFile(resolved));
      const binary = looksBinary(bytes);
      return {
        name,
        contents: binary ? "" : new TextDecoder().decode(bytes),
        binary,
        sizeBytes: bytes.byteLength,
      };
    });

  const readFileBytes: WorkspaceRepo["readFileBytes"] = (relPath) =>
    Effect.gen(function* () {
      const { name, resolved } = yield* resolveInProject(relPath);
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
      const { resolved } = yield* resolveInProject(relPath);
      yield* tryFs(fs.writeFileString(resolved, contents));
    });

  const createPath: WorkspaceRepo["createPath"] = (relPath, kind) =>
    Effect.gen(function* () {
      const { resolved } = yield* resolveInProject(relPath);
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
      const { resolved } = yield* resolveInProject(relPath);
      yield* tryFs(fs.remove(resolved, { recursive: true }));
    });

  const renamePath: WorkspaceRepo["renamePath"] = (fromRel, toRel) =>
    Effect.gen(function* () {
      const from = yield* resolveInProject(fromRel);
      const to = yield* resolveInProject(toRel);
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
