import * as Schema from "effect/Schema";
import { TerminalError } from "@byconvo/core/ports/terminal-exec";
import {
  NoRepoSelected,
  NotFound,
  Ok,
  StorageError,
} from "@byconvo/core/shared";
import {
  Thread,
  ThreadEntry,
  ThreadSummary,
  NewThread,
  RenameThread,
  RunCommand,
  ThreadIdParam,
} from "@byconvo/core/threads";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const errors = [NoRepoSelected, NotFound, StorageError, TerminalError] as const;

export class ThreadsApi extends HttpApiGroup.make("threads")
  .add(
    HttpApiEndpoint.get("list", "/threads", {
      success: Schema.Array(ThreadSummary),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/threads", {
      payload: NewThread,
      success: Thread,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("get", "/threads/:id", {
      params: ThreadIdParam,
      success: Thread,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("rename", "/threads/:id", {
      params: ThreadIdParam,
      payload: RenameThread,
      success: Thread,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("run", "/threads/:id/run", {
      params: ThreadIdParam,
      payload: RunCommand,
      success: ThreadEntry,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/threads/:id", {
      params: ThreadIdParam,
      success: Ok,
      error: errors,
    })
  ) {}
