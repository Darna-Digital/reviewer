import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { NoRepoSelected, StorageError } from "../../../shared.ts";
import type { InvalidRepo } from "../errors.ts";
import type {
  BrowsePayload,
  FileBytes,
  FileContent,
  RepoIndex,
  WorkspaceInfo,
} from "../schema/workspace.schema.ts";

export interface WorkspaceRepo {
  readonly info: Effect.Effect<WorkspaceInfo, StorageError>;
  /** Open `path` — a git repository — as the project. */
  readonly setCurrent: (
    path: string
  ) => Effect.Effect<WorkspaceInfo, InvalidRepo | StorageError>;
  /** Every repository the machine holds, as far as the index has got. */
  readonly repos: Effect.Effect<RepoIndex, StorageError>;
  /** Walk the machine for repositories again; the index fills in as it goes. */
  readonly rescan: Effect.Effect<RepoIndex, StorageError>;
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
  /** Show the path in the operating system's file manager. */
  readonly revealPath: (
    relPath: string
  ) => Effect.Effect<void, NoRepoSelected | StorageError>;
}
export class WorkspaceRepository extends Context.Service<
  WorkspaceRepository,
  WorkspaceRepo
>()("WorkspaceRepository") {}
