import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
  NoRepoSelected,
  NotFound,
  StorageError,
} from "../../../shared.ts";
import type { DevCommand } from "../schema/local-dev.schema.ts";

export interface CreateDevCommandInput {
  readonly name: string;
  readonly command: string;
  /** The project root it runs in; NotFound when the project holds no such root. */
  readonly repoPath: string;
}
export interface UpdateDevCommandInput {
  readonly name?: string;
  readonly command?: string;
  /** Given and different from the current one, the command moves root. */
  readonly repoPath?: string;
}
export type DevCommandsFailure = NoRepoSelected | NotFound | StorageError;

/**
 * Commands across every root the open project holds, not just the one the git
 * views follow: a project of a backend and a frontend runs both at once, so the
 * store is the project's and each command carries the root it belongs to.
 */
export interface DevCommandsRepo {
  /** Every root's commands, ordered by root then by age. */
  readonly list: Effect.Effect<ReadonlyArray<DevCommand>, DevCommandsFailure>;
  readonly get: (id: string) => Effect.Effect<DevCommand, DevCommandsFailure>;
  readonly create: (
    input: CreateDevCommandInput
  ) => Effect.Effect<DevCommand, DevCommandsFailure>;
  readonly update: (
    id: string,
    input: UpdateDevCommandInput
  ) => Effect.Effect<DevCommand, DevCommandsFailure>;
  readonly remove: (id: string) => Effect.Effect<void, DevCommandsFailure>;
}
export class DevCommandsRepository extends Context.Service<
  DevCommandsRepository,
  DevCommandsRepo
>()("DevCommandsRepository") {}
