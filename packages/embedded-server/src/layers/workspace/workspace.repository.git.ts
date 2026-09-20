/**
 * Git/filesystem-backed workspace repository — the real implementation, the
 * darna-stack ".db" equivalent. Owns opening a repository as the project,
 * listing the repositories the machine holds, browsing the filesystem and
 * file IO, mapping platform errors to StorageError.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import type { PlatformError } from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { homedir, platform } from "node:os";
import { resolve as pathResolve } from "node:path";
import { NoRepoSelected, StorageError } from "@reviewer/core/shared";
import { InvalidRepo, mediaTypeFor } from "@reviewer/core/workspace";
import { RepoIndexService } from "./repo-index.ts";
import { isGitRoot, readBranch } from "./repo-scan.ts";
import { resolveRepo, WorkspaceContext } from "./workspace-context.ts";
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
  const index = yield* RepoIndexService;

  const tryFs = <A, R>(effect: Effect.Effect<A, PlatformError, R>) =>
    effect.pipe(Effect.mapError(toStorageError));

  /** The open repository as the clients see it, its branch read afresh so a
   * checkout made elsewhere shows without reopening it. */
  const info: WorkspaceRepo["info"] = Effect.gen(function* () {
    const project = yield* ctx.current;
    return {
      project,
      branch: project === null ? null : yield* readBranch(project),
      recents: yield* ctx.recents,
      home: homedir(),
    } satisfies WorkspaceInfo;
  });

  const setCurrent: WorkspaceRepo["setCurrent"] = (path) =>
    Effect.gen(function* () {
      const root = yield* resolveRepo(fs, spawner, path).pipe(
        Effect.mapError(toStorageError)
      );
      if (root === null) {
        return yield* Effect.fail(
          new InvalidRepo({ path, reason: "not a git repository" })
        );
      }
      yield* ctx.selectRepo(root);
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
        entries.push({
          name,
          path: childPath,
          isGitRepo: yield* isGitRoot(childPath),
        });
      }
      const parent =
        path === "/" ? null : path.slice(0, path.lastIndexOf("/")) || "/";
      return {
        path,
        parent,
        isGitRepo: yield* isGitRoot(path),
        entries,
      } satisfies BrowsePayload;
    });

  /**
   * Resolve a path the views use against the repository root, refusing
   * anything that escapes it.
   */
  const resolveInProject = (relPath: string) =>
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
    repos: index.read,
    rescan: index.rescan,
    browse,
    readFile,
    readFileBytes,
    writeFile,
    revealPath,
  } satisfies WorkspaceRepo;
});
