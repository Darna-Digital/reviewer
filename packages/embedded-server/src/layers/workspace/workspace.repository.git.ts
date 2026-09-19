/**
 * Git/filesystem-backed workspace repository — the real implementation, the
 * darna-stack ".db" equivalent. Owns opening a project (a folder, which may
 * hold several git roots), moving between those roots, browsing the filesystem
 * and file IO, mapping platform errors to StorageError.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import type { PlatformError } from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { homedir, platform } from "node:os";
import { resolve as pathResolve } from "node:path";
import { NoRepoSelected, StorageError } from "@reviewer/core/shared";
import { InvalidRepo, mediaTypeFor } from "@reviewer/core/workspace";
import { countRepos, isGitRoot, scanRepos } from "./repo-scan.ts";
import { resolveWorkspace, WorkspaceContext } from "./workspace-context.ts";
import type {
  BrowseEntry,
  BrowsePayload,
  WorkspaceInfo,
  WorkspaceRepo,
} from "@reviewer/core/workspace";

const toStorageError = (error: PlatformError) =>
  new StorageError({ reason: error.message });

/** How each desktop asks its file manager to show a path and select it. */
export const revealCommand = (
  os: string,
  resolved: string
): { command: string; args: Array<string> } => {
  if (os === "darwin") return { command: "open", args: ["-R", resolved] };
  if (os === "win32") {
    return { command: "explorer", args: [`/select,${resolved}`] };
  }
  // No Linux file manager selects a file from the command line; the folder it
  // sits in is what every one of them opens.
  return {
    command: "xdg-open",
    args: [resolved.slice(0, resolved.lastIndexOf("/")) || "/"],
  };
};

// Git's own heuristic: a NUL byte in the first 8k means "not text".
const BINARY_SNIFF_BYTES = 8000;
const looksBinary = (bytes: Uint8Array) =>
  bytes.subarray(0, BINARY_SNIFF_BYTES).includes(0);

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

  const writeFile: WorkspaceRepo["writeFile"] = (relPath, contents) =>
    Effect.gen(function* () {
      const { resolved } = yield* resolveInProject(relPath);
      yield* tryFs(fs.writeFileString(resolved, contents));
    });

  const revealPath: WorkspaceRepo["revealPath"] = (relPath) =>
    Effect.gen(function* () {
      const { resolved } = yield* resolveInProject(relPath);
      const { args, command } = revealCommand(platform(), resolved);
      const exitCode = yield* tryFs(
        spawner.exitCode(ChildProcess.make(command, args))
      );
      if (exitCode !== 0) {
        return yield* Effect.fail(
          new StorageError({ reason: `could not reveal ${relPath}` })
        );
      }
    });

  return {
    info,
    setCurrent,
    selectRepo,
    browse,
    readFile,
    readFileBytes,
    writeFile,
    revealPath,
  } satisfies WorkspaceRepo;
});
