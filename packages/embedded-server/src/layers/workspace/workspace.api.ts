/** HTTP endpoints for project/repository selection, browsing and file IO. */
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";
import { NoRepoSelected, StorageError, Ok } from "@reviewer/core/shared";
import {
  InvalidRepo,
  BrowsePayload,
  CreatePath,
  FileBytes,
  FileContent,
  PathExists,
  RevealPath,
  Trashed,
  UploadFile,
  CopyPath,
  WorkspaceInfo,
  BrowseQuery,
  PathQuery,
  RenameFile,
  SelectRepo,
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
    HttpApiEndpoint.post("selectRepo", "/workspace/repo", {
      payload: SelectRepo,
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
    HttpApiEndpoint.post("createPath", "/file/create", {
      payload: CreatePath,
      success: Ok,
      error: [NoRepoSelected, PathExists, StorageError],
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
  )
  .add(
    HttpApiEndpoint.post("copyFile", "/file/copy", {
      payload: CopyPath,
      success: Ok,
      error: [NoRepoSelected, PathExists, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.post("uploadFile", "/file/upload", {
      payload: UploadFile,
      success: Ok,
      error: [NoRepoSelected, PathExists, StorageError],
    })
  )
  .add(
    HttpApiEndpoint.post("trashFile", "/file/trash", {
      payload: PathQuery,
      success: Trashed,
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
