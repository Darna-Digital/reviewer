/**
 * SQLite-backed dev-command store — commands belong to the repository they
 * run in, so each repository keeps its own and brings them along wherever it
 * is opened from.
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { NotFound } from "@reviewer/core/shared";
import { DevCommand } from "@reviewer/core/local-dev";
import { attempt } from "../db/db.service.ts";
import { documentTable } from "../db/documents.ts";
import { WorkspaceContext } from "../workspace/workspace-context.ts";
import type {
  CreateDevCommandInput,
  DevCommandsRepo,
  UpdateDevCommandInput,
} from "@reviewer/core/local-dev";

export const devCommands = documentTable<DevCommand>({
  table: "dev_command",
  sortColumn: "created_at",
  direction: "asc",
  decode: Schema.decodeUnknownSync(DevCommand),
});

// Module-scoped so ids stay unique across per-request repository instances.
let counter = 0;
const nextId = () => {
  counter += 1;
  return `d-${Date.now().toString(36)}-${counter}`;
};

export const makeSqliteDevCommandsRepository = Effect.gen(function* () {
  const ctx = yield* WorkspaceContext;

  const inRepo = <A>(f: (repoPath: string) => A) =>
    Effect.flatMap(ctx.requireCurrent, (repoPath) =>
      attempt(() => f(repoPath))
    );

  const requireCommand = (repoPath: string, id: string): DevCommand => {
    const command = devCommands.find(repoPath, id);
    if (command === undefined) {
      throw new NotFound({ reason: `dev command ${id} not found` });
    }
    return command;
  };

  const list: DevCommandsRepo["list"] = inRepo((repoPath) =>
    devCommands.list(repoPath)
  );

  const get: DevCommandsRepo["get"] = (id) =>
    inRepo((repoPath) => requireCommand(repoPath, id));

  const create: DevCommandsRepo["create"] = (input: CreateDevCommandInput) =>
    inRepo((repoPath) => {
      const now = new Date().toISOString();
      const created: DevCommand = {
        id: nextId(),
        name: input.name.trim(),
        command: input.command.trim(),
        createdAt: now,
        updatedAt: now,
      };
      devCommands.put(repoPath, created.id, created.createdAt, created);
      return created;
    });

  const update: DevCommandsRepo["update"] = (
    id,
    input: UpdateDevCommandInput
  ) =>
    inRepo((repoPath) => {
      const existing = requireCommand(repoPath, id);
      const updated: DevCommand = {
        ...existing,
        name:
          input.name !== undefined && input.name.trim().length > 0
            ? input.name.trim()
            : existing.name,
        command:
          input.command !== undefined && input.command.trim().length > 0
            ? input.command.trim()
            : existing.command,
        updatedAt: new Date().toISOString(),
      };
      devCommands.put(repoPath, id, updated.createdAt, updated);
      return updated;
    });

  const remove: DevCommandsRepo["remove"] = (id) =>
    inRepo((repoPath) => {
      requireCommand(repoPath, id);
      devCommands.remove(repoPath, id);
    });

  return { list, get, create, update, remove } satisfies DevCommandsRepo;
});
