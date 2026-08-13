/**
 * File-backed dev-command store — one `.byconvo/dev-commands.json` per git root
 * the open project holds, so a project of a `backend` and a `frontend` keeps
 * each one's commands with the repository they run in, and a root cloned into
 * the folder brings its own along. Reads cover every root at once; a write only
 * touches the root that owns the command. Mirrors the terminal-threads file
 * repository.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { NotFound, StorageError } from "@byconvo/core/shared";
import { DevCommandDefinition } from "@byconvo/core/local-dev";
import { scanRepos } from "../workspace/repo-scan.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import type {
  CreateDevCommandInput,
  DevCommand,
  DevCommandsRepo,
  UpdateDevCommandInput,
} from "@byconvo/core/local-dev";
import type { RepoEntry } from "@byconvo/core/workspace";

const DevCommandsFile = Schema.Array(DevCommandDefinition);

const commandsPath = (repoPath: string) =>
  `${repoPath}/.byconvo/dev-commands.json`;

const readCommands = (
  repoPath: string
): ReadonlyArray<DevCommandDefinition> => {
  try {
    const raw = readFileSync(commandsPath(repoPath), "utf8");
    return Schema.decodeUnknownSync(DevCommandsFile)(JSON.parse(raw));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const writeCommands = (
  repoPath: string,
  commands: ReadonlyArray<DevCommandDefinition>
) => {
  mkdirSync(`${repoPath}/.byconvo`, { recursive: true });
  writeFileSync(
    commandsPath(repoPath),
    `${JSON.stringify(commands, null, 2)}\n`
  );
};

const inRepo = (
  repo: RepoEntry,
  definition: DevCommandDefinition
): DevCommand => ({ ...definition, repo: repo.name, repoPath: repo.path });

// Module-scoped so ids stay unique across per-request repository instances.
let counter = 0;
const nextId = () => {
  counter += 1;
  return `d-${Date.now().toString(36)}-${counter}`;
};

export const makeFileDevCommandsRepository = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const ctx = yield* WorkspaceContext;

  /** The project's roots, freshly scanned so a new clone shows up unprompted. */
  const roots = Effect.flatMap(ctx.requireProject, (project) =>
    scanRepos(fs, project)
  );

  const withRoots = <A>(f: (repos: ReadonlyArray<RepoEntry>) => A) =>
    Effect.flatMap(roots, (repos) =>
      Effect.try({
        try: () => f(repos),
        // A thrown NotFound is a real 404, not a storage failure — preserve it.
        catch: (error) =>
          error instanceof NotFound
            ? error
            : new StorageError({
                reason: error instanceof Error ? error.message : String(error),
              }),
      })
    );

  const requireRoot = (repos: ReadonlyArray<RepoEntry>, repoPath: string) => {
    const repo = repos.find((entry) => entry.path === repoPath);
    if (repo === undefined) {
      throw new NotFound({
        reason: `${repoPath} is not a repository of the open project`,
      });
    }
    return repo;
  };

  /** The command with that id, and the root whose file holds it. */
  const requireCommand = (repos: ReadonlyArray<RepoEntry>, id: string) => {
    for (const repo of repos) {
      const definition = readCommands(repo.path).find((c) => c.id === id);
      if (definition !== undefined) return { repo, definition };
    }
    throw new NotFound({ reason: `dev command ${id} not found` });
  };

  const list: DevCommandsRepo["list"] = withRoots((repos) =>
    repos.flatMap((repo) =>
      [...readCommands(repo.path)]
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((definition) => inRepo(repo, definition))
    )
  );

  const get: DevCommandsRepo["get"] = (id) =>
    withRoots((repos) => {
      const { repo, definition } = requireCommand(repos, id);
      return inRepo(repo, definition);
    });

  const create: DevCommandsRepo["create"] = (input: CreateDevCommandInput) =>
    withRoots((repos) => {
      const repo = requireRoot(repos, input.repoPath);
      const now = new Date().toISOString();
      const created: DevCommandDefinition = {
        id: nextId(),
        name: input.name.trim(),
        command: input.command.trim(),
        createdAt: now,
        updatedAt: now,
      };
      writeCommands(repo.path, [...readCommands(repo.path), created]);
      return inRepo(repo, created);
    });

  const update: DevCommandsRepo["update"] = (
    id,
    input: UpdateDevCommandInput
  ) =>
    withRoots((repos) => {
      const { repo, definition } = requireCommand(repos, id);
      const updated: DevCommandDefinition = {
        ...definition,
        name:
          input.name !== undefined && input.name.trim().length > 0
            ? input.name.trim()
            : definition.name,
        command:
          input.command !== undefined && input.command.trim().length > 0
            ? input.command.trim()
            : definition.command,
        updatedAt: new Date().toISOString(),
      };
      const target =
        input.repoPath === undefined || input.repoPath === repo.path
          ? repo
          : requireRoot(repos, input.repoPath);
      if (target.path !== repo.path) {
        writeCommands(
          repo.path,
          readCommands(repo.path).filter((c) => c.id !== id)
        );
        writeCommands(target.path, [...readCommands(target.path), updated]);
        return inRepo(target, updated);
      }
      writeCommands(
        repo.path,
        readCommands(repo.path).map((c) => (c.id === id ? updated : c))
      );
      return inRepo(repo, updated);
    });

  const remove: DevCommandsRepo["remove"] = (id) =>
    withRoots((repos) => {
      const { repo } = requireCommand(repos, id);
      writeCommands(
        repo.path,
        readCommands(repo.path).filter((c) => c.id !== id)
      );
    });

  return { list, get, create, update, remove } satisfies DevCommandsRepo;
});
