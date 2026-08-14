import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type {
  NoRepoSelected,
  NotFound,
  StorageError,
} from "../../../shared.ts";
import type { TerminalError } from "../../../ports/terminal-exec.ts";
import type { ChatBusy } from "../errors.ts";
import type {
  Chat,
  ChatAccess,
  ChatEffort,
  ChatProviderKind,
  ChatSummary,
} from "../schema/chats.schema.ts";

export interface CreateChatInput {
  readonly title: string;
  readonly provider: ChatProviderKind;
  readonly model: string;
  readonly effort: ChatEffort;
  readonly access: ChatAccess;
  readonly branch: string;
}
export interface UpdateChatInput {
  readonly title?: string;
  readonly provider?: ChatProviderKind;
  readonly model?: string;
  readonly effort?: ChatEffort;
  readonly access?: ChatAccess;
}
export type ChatsFailure =
  NoRepoSelected | NotFound | StorageError | TerminalError | ChatBusy;
export interface ChatsRepo {
  readonly list: Effect.Effect<ReadonlyArray<ChatSummary>, ChatsFailure>;
  readonly get: (id: string) => Effect.Effect<Chat, ChatsFailure>;
  readonly create: (
    input: CreateChatInput
  ) => Effect.Effect<Chat, ChatsFailure>;
  readonly update: (
    id: string,
    input: UpdateChatInput
  ) => Effect.Effect<Chat, ChatsFailure>;
  readonly remove: (id: string) => Effect.Effect<void, ChatsFailure>;
}
export class ChatsRepository extends Context.Service<
  ChatsRepository,
  ChatsRepo
>()("ChatsRepository") {}
