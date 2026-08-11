import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { NoRepoSelected, StorageError } from "../../../shared.ts";
import type { InvalidRepo, PathExists } from "../errors.ts";
import type {
  BrowsePayload,
  FileBytes,
  FileContent,
  PathKind,
  WorkspaceInfo,
} from "../schema/workspace.schema.ts";

export interface WorkspaceRepo {
  readonly info: Effect.Effect<WorkspaceInfo, StorageError>;
  /** Open `path` as the project, discovering the git roots it holds. */
  readonly setCurrent: (
    path: string
  ) => Effect.Effect<WorkspaceInfo, InvalidRepo | StorageError>;
  /**
   * Point the git views at one of the open project's roots. Fails with
   * `InvalidRepo` for a path the project does not hold, so a stale selection
   * can never take the rest of the app somewhere the project isn't.
   */
  readonly selectRepo: (
    path: string
  ) => Effect.Effect<WorkspaceInfo, InvalidRepo | StorageError>;
  readonly browse: (
    path: string | null
  ) => Effect.Effect<BrowsePayload, StorageError>;
  readonly readFile: (
    relPath: string
  ) => Effect.Effect<FileContent, NoRepoSelected | StorageError>;
  readonly readFileBytes: (
    relPath: string
  ) => Effect.Effect<FileBytes, NoRepoSelected | StorageError>;
  readonly writeFile: (
    relPath: string,
    contents: string
  ) => Effect.Effect<void, NoRepoSelected | StorageError>;
  /** Create an empty file or directory, refusing to overwrite what is there. */
  readonly createPath: (
    relPath: string,
    kind: PathKind
  ) => Effect.Effect<void, NoRepoSelected | PathExists | StorageError>;
  readonly deletePath: (
    relPath: string
  ) => Effect.Effect<void, NoRepoSelected | StorageError>;
  readonly renamePath: (
    fromRel: string,
    toRel: string
  ) => Effect.Effect<void, NoRepoSelected | StorageError>;
}
export class WorkspaceRepository extends Context.Service<
  WorkspaceRepository,
  WorkspaceRepo
>()("WorkspaceRepository") {}
