import * as Schema from "effect/Schema";
import {
  ChatBusy,
  Chat,
  ChatListQuery,
  ChatModelCatalog,
  ChatPage,
  ChatProjectTally,
  ChatIdParam,
  NewChat,
  SendChatMessage,
  UpdateChat,
} from "@byconvo/core/chats";
import { TerminalError } from "@byconvo/core/ports/terminal-exec";
import {
  NoRepoSelected,
  NotFound,
  Ok,
  StorageError,
} from "@byconvo/core/shared";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

const errors = [
  NoRepoSelected,
  NotFound,
  StorageError,
  TerminalError,
  ChatBusy,
] as const;

export class ChatsApi extends HttpApiGroup.make("chats")
  .add(
    // A page of the sessions list, filtered and cursored — see `ChatListQuery`.
    HttpApiEndpoint.get("list", "/chats", {
      query: ChatListQuery,
      success: ChatPage,
      error: errors,
    })
  )
  .add(
    // The composer's model picker catalog. Registered before /chats/:id so
    // "models" never parses as a chat id.
    HttpApiEndpoint.get("models", "/chats/models", {
      success: ChatModelCatalog,
      error: errors,
    })
  )
  .add(
    // Likewise ahead of /chats/:id. The filter menu's projects, over every
    // session rather than over the pages the client happens to hold.
    HttpApiEndpoint.get("projects", "/chats/projects", {
      success: Schema.Array(ChatProjectTally),
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("create", "/chats", {
      payload: NewChat,
      success: Chat,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.get("get", "/chats/:id", {
      params: ChatIdParam,
      success: Chat,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("PATCH")("update", "/chats/:id", {
      params: ChatIdParam,
      payload: UpdateChat,
      success: Chat,
      error: errors,
    })
  )
  .add(
    // Starts a turn; progress streams over the chat WebSocket
    // (/api/chats/stream?chat=:id). Returns the chat with the new user
    // message and the streaming assistant placeholder already appended.
    HttpApiEndpoint.post("send", "/chats/:id/messages", {
      params: ChatIdParam,
      payload: SendChatMessage,
      success: Chat,
      error: errors,
    })
  )
  .add(
    // Records that the reader has this session open, which is what settles the
    // row's dots — see `chats.attention.ts` in core.
    HttpApiEndpoint.post("seen", "/chats/:id/seen", {
      params: ChatIdParam,
      success: Ok,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.post("stop", "/chats/:id/stop", {
      params: ChatIdParam,
      success: Ok,
      error: errors,
    })
  )
  .add(
    HttpApiEndpoint.make("DELETE")("remove", "/chats/:id", {
      params: ChatIdParam,
      success: Ok,
      error: errors,
    })
  ) {}
