/** HTTP endpoints for repository selection, directory browsing and file IO. */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { NoRepoSelected, StorageError } from "@byconvo/core/errors"
import { Ok } from "@byconvo/core/shared"
import {
  InvalidRepo,
  BrowsePayload,
  FileContent,
  WorkspaceInfo,
  BrowseQuery,
  PathQuery,
  RenameFile,
  SetWorkspace,
  WriteFile,
} from "@byconvo/core/workspace"

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
    HttpApiEndpoint.put("writeFile", "/file", {
      payload: WriteFile,
      success: Ok,
      error: [NoRepoSelected, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("deleteFile", "/file", {
      query: PathQuery,
      success: Ok,
      error: [NoRepoSelected, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.post("renameFile", "/file/rename", {
      payload: RenameFile,
      success: Ok,
      error: [NoRepoSelected, StorageError],
    })
  ) {}
