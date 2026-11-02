import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
  NoRepoSelected,
  NotFound,
  StorageError,
} from "../../../shared.ts";
import type { InvalidRepo } from "../errors.ts";
import type {
  BrowsePayload,
  CreateWorkspace,
  FileBytes,
  FileContent,
  RepoIndex,
  SavedWorkspace,
  SavedWorkspaces,
  UpdateWorkspace,
  WorkspaceInfo,
} from "../schema/workspace.schema.ts";

export interface WorkspaceRepo {
  readonly info: Effect.Effect<WorkspaceInfo, StorageError>;
  /** Open `path` — a git repository — on its own, as a workspace of one. */
  readonly setCurrent: (
    path: string
  ) => Effect.Effect<WorkspaceInfo, InvalidRepo | StorageError>;
  /**
   * Replace the open workspace's repositories; a saved workspace keeps the
   * new set, so it opens with them next time too.
   */
  readonly setRoots: (
    roots: ReadonlyArray<string>
  ) => Effect.Effect<WorkspaceInfo, InvalidRepo | StorageError>;
  /** The workspaces kept to come back to, most recently opened first. */
  readonly workspaces: Effect.Effect<SavedWorkspaces, StorageError>;
  readonly createWorkspace: (
    input: CreateWorkspace
  ) => Effect.Effect<SavedWorkspace, InvalidRepo | StorageError>;
  readonly updateWorkspace: (
    id: string,
    patch: UpdateWorkspace
  ) => Effect.Effect<SavedWorkspace, NotFound | InvalidRepo | StorageError>;
  readonly deleteWorkspace: (
    id: string
  ) => Effect.Effect<void, NotFound | StorageError>;
  /** Open every repository a saved workspace holds, side by side. */
  readonly openWorkspace: (
    id: string
  ) => Effect.Effect<WorkspaceInfo, NotFound | InvalidRepo | StorageError>;
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
