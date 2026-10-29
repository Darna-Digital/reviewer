/**
 * HTTP endpoints for the workspace — the repositories open side by side, the
 * saved workspaces to open them from — repository browsing and file IO.
 */
import { HttpApiEndpoint, HttpApiGroup } from "effect/http-api";
import {
  NoRepoSelected,
  NotFound,
  StorageError,
  Ok,
} from "@reviewer/core/shared";
import {
  InvalidRepo,
  BrowsePayload,
  CreateWorkspace,
  FileBytes,
  FileContent,
  RevealPath,
  SavedWorkspace,
  SavedWorkspaces,
  SetRoots,
  UpdateWorkspace,
  WorkspaceIdParams,
  WorkspaceInfo,
  BrowseQuery,
  PathQuery,
  RepoIndex,
  SetWorkspace,
  WriteFile,
} from "@reviewer/core/workspace";

export class WorkspaceApi extends HttpApiGroup.make("workspace")
  .add(
    HttpApiEndpoint.get("info", "/workspace", {
      success: WorkspaceInfo,
      error: StorageError,
    })
  )
  .add(
    HttpApiEndpoint.post("setCurrent", "/workspace", {
      payload: SetWorkspace,
      success: WorkspaceInfo,
      error: [InvalidRepo, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.put("setRoots", "/workspace/roots", {
      payload: SetRoots,
      success: WorkspaceInfo,
      error: [InvalidRepo, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.get("workspaces", "/workspaces", {
      success: SavedWorkspaces,
      error: StorageError,
    })
  )
  .add(
    HttpApiEndpoint.post("createWorkspace", "/workspaces", {
      payload: CreateWorkspace,
      success: SavedWorkspace,
      error: [InvalidRepo, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.patch("updateWorkspace", "/workspaces/:id", {
      params: WorkspaceIdParams,
      payload: UpdateWorkspace,
      success: SavedWorkspace,
      error: [NotFound, InvalidRepo, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.delete("deleteWorkspace", "/workspaces/:id", {
      params: WorkspaceIdParams,
      success: Ok,
      error: [NotFound, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.post("openWorkspace", "/workspaces/:id/open", {
      params: WorkspaceIdParams,
      success: WorkspaceInfo,
      error: [NotFound, InvalidRepo, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.get("repos", "/repos", {
      success: RepoIndex,
      error: StorageError,
    })
  )
  .add(
    HttpApiEndpoint.post("rescanRepos", "/repos/scan", {
      success: RepoIndex,
      error: StorageError,
    })
  )
  .add(
    HttpApiEndpoint.get("browse", "/fs/browse", {
      query: BrowseQuery,
      success: BrowsePayload,
      error: StorageError,
    })
  )
  .add(
    HttpApiEndpoint.get("readFile", "/file", {
      query: PathQuery,
      success: FileContent,
      error: [NoRepoSelected, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.get("readFileBytes", "/file/raw", {
      query: PathQuery,
      success: FileBytes,
      error: [NoRepoSelected, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.put("writeFile", "/file", {
      payload: WriteFile,
      success: Ok,
      error: [NoRepoSelected, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.post("revealFile", "/file/reveal", {
      payload: RevealPath,
      success: Ok,
      error: [NoRepoSelected, StorageError],
    })
  ) {}
