import * as Context from "effect/Context"
import type * as Effect from "effect/Effect"
import type {
  ChatBusy,
  NoRepoSelected,
  NotFound,
  StorageError,
  TerminalError,
} from "../../errors.ts"
import type {
  Chat,
  ChatAccess,
  ChatEffort,
  ChatMode,
  ChatProviderKind,
  ChatSummary,
} from "./chats.schema.ts"

export interface CreateChatInput {
  readonly title: string
  readonly provider: ChatProviderKind
  readonly model: string
  readonly effort: ChatEffort
  readonly access: ChatAccess
  readonly mode: ChatMode
  readonly branch: string
}
export interface UpdateChatInput {
  readonly title?: string
  readonly provider?: ChatProviderKind
  readonly model?: string
  readonly effort?: ChatEffort
  readonly access?: ChatAccess
  readonly mode?: ChatMode
}
export type ChatsFailure =
  | NoRepoSelected
  | NotFound
  | StorageError
  | TerminalError
  | ChatBusy
export interface ChatsRepo {
  readonly list: Effect.Effect<ReadonlyArray<ChatSummary>, ChatsFailure>
  readonly get: (id: string) => Effect.Effect<Chat, ChatsFailure>
  readonly create: (input: CreateChatInput) => Effect.Effect<Chat, ChatsFailure>
  readonly update: (
    id: string,
    input: UpdateChatInput
  ) => Effect.Effect<Chat, ChatsFailure>
  readonly remove: (id: string) => Effect.Effect<void, ChatsFailure>
}
export class ChatsRepository extends Context.Service<
  ChatsRepository,
  ChatsRepo
>()("ChatsRepository") {}
