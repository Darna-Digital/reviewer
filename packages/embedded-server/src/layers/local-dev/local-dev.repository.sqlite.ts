/**
 * SQLite-backed dev-command store — commands belong to the git root they run
 * in, so a project of a `backend` and a `frontend` keeps each one's commands
 * with its repository, and a root cloned into the folder brings its own along.
 *
 * The roots are re-scanned on every read rather than remembered, which is what
 * makes a freshly cloned repository show up without the user re-opening the
 * project. Reads cover every root at once; a write only touches the root that
 * owns the command.
 */
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";
import { NotFound } from "@reviewer/core/shared";
import { DevCommandDefinition } from "@reviewer/core/local-dev";
import { attempt } from "../db/db.service.ts";
import { documentTable } from "../db/documents.ts";
import { scanRepos } from "../workspace/repo-scan.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import type {
  CreateDevCommandInput,
  DevCommand,
  DevCommandsRepo,
  UpdateDevCommandInput,
} from "@reviewer/core/local-dev";
import type { RepoEntry } from "@reviewer/core/workspace";

export const devCommands = documentTable<DevCommandDefinition>({
  table: "dev_command",
  sortColumn: "created_at",
  direction: "asc",
  decode: Schema.decodeUnknownSync(DevCommandDefinition),
});

const inRepoEntry = (
  repo: RepoEntry,
  definition: DevCommandDefinition
): DevCommand => ({ ...definition, repo: repo.name, repoPath: repo.path });

// Module-scoped so ids stay unique across per-request repository instances.
let counter = 0;
const nextId = () => {
  counter += 1;
  return `d-${Date.now().toString(36)}-${counter}`;
};

export const makeSqliteDevCommandsRepository = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const ctx = yield* WorkspaceContext;

  /** The project's roots, freshly scanned so a new clone shows up unprompted. */
  const roots = Effect.flatMap(ctx.requireProject, (project) =>
    scanRepos(fs, project)
  );

  const withRoots = <A>(f: (repos: ReadonlyArray<RepoEntry>) => A) =>
    // The scope here is the project's scan, not a selected root: a project can
    // hold several repositories, and its dev commands are listed together.
    Effect.flatMap(roots, (repos) => attempt(() => f(repos)));

  const requireRoot = (repos: ReadonlyArray<RepoEntry>, repoPath: string) => {
    const repo = repos.find((entry) => entry.path === repoPath);
    if (repo === undefined) {
      throw new NotFound({
        reason: `${repoPath} is not a repository of the open project`,
      });
    }
    return repo;
  };

  /** The command with that id, and the root that owns it. */
  const requireCommand = (repos: ReadonlyArray<RepoEntry>, id: string) => {
    for (const repo of repos) {
      const definition = devCommands.find(repo.path, id);
      if (definition !== undefined) return { repo, definition };
    }
    throw new NotFound({ reason: `dev command ${id} not found` });
  };

  const list: DevCommandsRepo["list"] = withRoots((repos) =>
    repos.flatMap((repo) =>
      devCommands
        .list(repo.path)
        .map((definition) => inRepoEntry(repo, definition))
    )
  );

  const get: DevCommandsRepo["get"] = (id) =>
    withRoots((repos) => {
      const { repo, definition } = requireCommand(repos, id);
      return inRepoEntry(repo, definition);
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
      devCommands.put(repo.path, created.id, created.createdAt, created);
      return inRepoEntry(repo, created);
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
      // Moving a command between roots is a re-scope, not a second row: `put`
      // upserts on the id, so the old root's copy is not left behind.
      if (target.path !== repo.path) devCommands.remove(repo.path, id);
      devCommands.put(target.path, id, updated.createdAt, updated);
      return inRepoEntry(target, updated);
    });

  const remove: DevCommandsRepo["remove"] = (id) =>
    withRoots((repos) => {
      const { repo } = requireCommand(repos, id);
      devCommands.remove(repo.path, id);
    });

  return { list, get, create, update, remove } satisfies DevCommandsRepo;
});
