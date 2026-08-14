import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
  NoRepoSelected,
  NotFound,
  StorageError,
} from "../../../shared.ts";
import type { TerminalError } from "../../../ports/terminal-exec.ts";
import type {
  AgentKind,
  Thread,
  ThreadEntry,
  ThreadSummary,
} from "../schema/threads.schema.ts";

export interface CreateThreadInput {
  readonly title: string;
  readonly agent: AgentKind;
  readonly branch: string;
  readonly taskKey: string | null;
  readonly initialPrompt: string;
}
export interface RenameThreadInput {
  readonly title: string;
  readonly branch?: string;
  readonly taskKey?: string | null;
}
export type ThreadsFailure =
  NoRepoSelected | NotFound | StorageError | TerminalError;
export interface ThreadsRepo {
  readonly list: Effect.Effect<ReadonlyArray<ThreadSummary>, ThreadsFailure>;
  readonly get: (id: string) => Effect.Effect<Thread, ThreadsFailure>;
  readonly create: (
    input: CreateThreadInput
  ) => Effect.Effect<Thread, ThreadsFailure>;
  readonly rename: (
    id: string,
    input: RenameThreadInput
  ) => Effect.Effect<Thread, ThreadsFailure>;
  readonly remove: (id: string) => Effect.Effect<void, ThreadsFailure>;
  readonly run: (
    id: string,
    command: string
  ) => Effect.Effect<ThreadEntry, ThreadsFailure>;
}
export class ThreadsRepository extends Context.Service<
  ThreadsRepository,
  ThreadsRepo
>()("ThreadsRepository") {}
