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
  ChatPage,
  ChatProjectTally,
  ChatProviderKind,
} from "../schema/chats.schema.ts";

/**
 * A page of the sessions list, parsed from what the URL asked for. The store
 * takes this rather than the raw strings so the parsing — and the ceiling on
 * `limit` — happens once, at the edge.
 */
export interface ListChatsInput {
  readonly limit: number;
  /** Where the previous page left off; absent starts at the newest. */
  readonly cursor: string | null;
  /** Free text over title, last message and project name. */
  readonly search: string | null;
  /** A project's absolute path; null means every project. */
  readonly projectPath: string | null;
  /** ISO timestamp — only sessions touched at or after it. */
  readonly since: string | null;
}

export interface CreateChatInput {
  readonly title: string;
  readonly provider: ChatProviderKind;
  readonly model: string;
  readonly effort: ChatEffort;
  readonly access: ChatAccess;
  readonly branch: string;
  /** The checkout to run in; absent means the one the app has selected. */
  readonly repoPath?: string;
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
  readonly list: (
    input: ListChatsInput
  ) => Effect.Effect<ChatPage, ChatsFailure>;
  /** Every project holding a session, for the list's own filter menu. */
  readonly projects: Effect.Effect<
    ReadonlyArray<ChatProjectTally>,
    ChatsFailure
  >;
  readonly get: (id: string) => Effect.Effect<Chat, ChatsFailure>;
  readonly create: (
    input: CreateChatInput
  ) => Effect.Effect<Chat, ChatsFailure>;
  readonly update: (
    id: string,
    input: UpdateChatInput
  ) => Effect.Effect<Chat, ChatsFailure>;
  readonly remove: (id: string) => Effect.Effect<void, ChatsFailure>;
  /**
   * Records that the reader has the session open now, which is what settles
   * both of the list's dots — see `chats.attention.ts`. Idempotent: the mark is
   * simply moved to the present, so repeating it costs nothing.
   */
  readonly markSeen: (id: string) => Effect.Effect<void, ChatsFailure>;
}
export class ChatsRepository extends Context.Service<
  ChatsRepository,
  ChatsRepo
>()("ChatsRepository") {}
