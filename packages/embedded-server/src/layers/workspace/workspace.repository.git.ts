/**
 * Git/filesystem-backed workspace repository — the real implementation, the
 * darna-stack ".db" equivalent. Owns opening a repository as the project,
 * listing the repositories the machine holds, browsing the filesystem and
 * file IO, mapping platform errors to StorageError.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import type { PlatformError, SystemErrorTag } from "effect/PlatformError";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { homedir, platform } from "node:os";
import { resolve as pathResolve } from "node:path";
import { NoRepoSelected, NotFound, StorageError } from "@reviewer/core/shared";
import {
  folderName,
  InvalidRepo,
  mediaTypeFor,
} from "@reviewer/core/workspace";
import { RepoIndexService } from "./repo-index.ts";
import { isGitRoot, readBranch } from "./repo-scan.ts";
import * as saved from "./saved-workspaces.ts";
import { resolveRepo, WorkspaceContext } from "./workspace-context.ts";
import type {
  BrowseEntry,
  BrowsePayload,
  WorkspaceInfo,
  WorkspaceRepo,
} from "@reviewer/core/workspace";

/**
 * What each normalised system failure means to the person reading it. The
 * platform's own message ("NotFound: FileSystem.readFile (/abs/path)") is
 * written for a log, not for the pane the client shows it in, and the client
 * already knows which path it asked for.
 */
const PLAIN_REASONS: Partial<Record<SystemErrorTag, string>> = {
  NotFound: "It no longer exists on disk.",
  PermissionDenied: "You don't have permission to access it.",
  Busy: "Something else has it locked right now.",
  TimedOut: "Reading it took too long.",
  InvalidData: "Its contents could not be read.",
};

const toStorageError = (error: PlatformError) =>
  new StorageError({
    reason:
      (error.reason._tag !== "BadArgument" &&
        PLAIN_REASONS[error.reason._tag]) ||
      error.message,
  });

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

/** A write to the shared database, its failure told as a StorageError. */
const tryDb = <A>(write: () => A) =>
  Effect.try({
    try: write,
    catch: (error) =>
      new StorageError({
        reason: error instanceof Error ? error.message : String(error),
      }),
  });

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

  /** The open workspace as the clients see it, each root's branch read
   * afresh so a checkout made elsewhere shows without reopening it. */
  const info: WorkspaceRepo["info"] = Effect.gen(function* () {
    const project = yield* ctx.current;
    const roots = yield* Effect.forEach(yield* ctx.roots, (path) =>
      Effect.map(readBranch(path), (branch) => ({
        path,
        name: folderName(path),
        branch,
      }))
    );
    const savedId = yield* ctx.savedId;
    const openSaved =
      savedId === null ? undefined : saved.findWorkspace(savedId);
    return {
      project,
      branch:
        roots.find((root) => root.path === project)?.branch ??
        (project === null ? null : yield* readBranch(project)),
      roots,
      workspace:
        openSaved === undefined
          ? null
          : { id: openSaved.id, name: openSaved.name },
      recents: yield* ctx.recents,
      home: homedir(),
    } satisfies WorkspaceInfo;
  });

  /** `path` as the root of the repository it is in, or why it is not one. */
  const rootOf = (path: string) =>
    Effect.gen(function* () {
      const root = yield* resolveRepo(fs, spawner, path).pipe(
        Effect.mapError(toStorageError)
      );
      if (root === null) {
        return yield* Effect.fail(
          new InvalidRepo({ path, reason: "not a git repository" })
        );
      }
      return root;
    });

  /** Every path as its repository's root, each once, in the order given. */
  const rootsOf = (paths: ReadonlyArray<string>) =>
    Effect.map(Effect.forEach(paths, rootOf), (roots) => [...new Set(roots)]);

  const setCurrent: WorkspaceRepo["setCurrent"] = (path) =>
    Effect.gen(function* () {
      yield* ctx.selectRepo(yield* rootOf(path));
      return yield* info;
    });

  const setRoots: WorkspaceRepo["setRoots"] = (paths) =>
    Effect.gen(function* () {
      const roots = yield* rootsOf(paths);
      const savedId = yield* ctx.savedId;
      if (savedId !== null) {
        yield* tryDb(() => saved.updateWorkspace(savedId, { roots }));
      }
      yield* ctx.openRoots(roots, savedId);
      return yield* info;
    });

  const workspaces: WorkspaceRepo["workspaces"] = tryDb(saved.listWorkspaces);

  const createWorkspace: WorkspaceRepo["createWorkspace"] = (input) =>
    Effect.gen(function* () {
      const roots = yield* rootsOf(input.roots);
      return yield* tryDb(() =>
        saved.createWorkspace(input.name.trim() || "Workspace", roots)
      );
    });

  const noSuchWorkspace = (id: string) =>
    new NotFound({ reason: `There is no workspace ${id}.` });

  const updateWorkspace: WorkspaceRepo["updateWorkspace"] = (id, patch) =>
    Effect.gen(function* () {
      const roots =
        patch.roots === undefined ? undefined : yield* rootsOf(patch.roots);
      const name = patch.name?.trim();
      const updated = yield* tryDb(() =>
        saved.updateWorkspace(id, {
          ...(name ? { name } : {}),
          ...(roots === undefined ? {} : { roots }),
        })
      );
      if (updated === undefined) return yield* Effect.fail(noSuchWorkspace(id));
      // The open workspace follows its saved self: a repository added to it
      // opens beside the others, one taken out closes.
      if (roots !== undefined && (yield* ctx.savedId) === id) {
        yield* ctx.openRoots(updated.roots, id);
      }
      return updated;
    });

  const deleteWorkspace: WorkspaceRepo["deleteWorkspace"] = (id) =>
    Effect.gen(function* () {
      const deleted = yield* tryDb(() => saved.deleteWorkspace(id));
      if (!deleted) return yield* Effect.fail(noSuchWorkspace(id));
      // Its repositories stay open, as repositories opened on their own.
      if ((yield* ctx.savedId) === id) {
        yield* ctx.openRoots(yield* ctx.roots, null);
      }
    });

  const openWorkspace: WorkspaceRepo["openWorkspace"] = (id) =>
    Effect.gen(function* () {
      const found = yield* tryDb(() => saved.findWorkspace(id));
      if (found === undefined) return yield* Effect.fail(noSuchWorkspace(id));
      // A repository moved or deleted since the workspace was saved is left
      // out rather than refusing the rest — the workspace still opens, and
      // keeps it, so it is back once the folder is.
      const roots = (yield* Effect.forEach(found.roots, (path) =>
        resolveRepo(fs, spawner, path).pipe(
          Effect.catch(() => Effect.succeed(null))
        )
      )).filter((root): root is string => root !== null);
      if (roots.length === 0) {
        return yield* Effect.fail(
          new InvalidRepo({
            path: found.name,
            reason: "none of its repositories are on disk any more",
          })
        );
      }
      yield* tryDb(() => saved.markWorkspaceOpened(id));
      yield* ctx.openRoots(roots, id);
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
    setRoots,
    workspaces,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    openWorkspace,
    repos: index.read,
    rescan: index.rescan,
    browse,
    readFile,
    readFileBytes,
    writeFile,
    revealPath,
  } satisfies WorkspaceRepo;
});
