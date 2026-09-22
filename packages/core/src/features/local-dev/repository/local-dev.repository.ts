import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
  NoRepoSelected,
  NotFound,
  StorageError,
} from "../../../shared.ts";
import type {
  DevCommand,
  DevCommandKind,
} from "../schema/local-dev.schema.ts";

export interface CreateDevCommandInput {
  /** A shell command when not given. */
  readonly kind?: DevCommandKind;
  readonly name: string;
  readonly command: string;
  /** Repository-relative; missing or empty means the root. */
  readonly cwd?: string;
}
export interface UpdateDevCommandInput {
  readonly name?: string;
  readonly command?: string;
  readonly cwd?: string;
}
export type DevCommandsFailure = NoRepoSelected | NotFound | StorageError;

/** The open repository's dev commands, oldest first. */
export interface DevCommandsRepo {
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
