import * as Schema from "effect/Schema"
import {
  ChatAccess,
  ChatEffort,
  ChatMode,
  ChatProviderKind,
} from "./chats.schema.model.ts"

export const NewChat = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  provider: Schema.optionalKey(ChatProviderKind),
  model: Schema.optionalKey(Schema.String),
  effort: Schema.optionalKey(ChatEffort),
  access: Schema.optionalKey(ChatAccess),
  mode: Schema.optionalKey(ChatMode),
  branch: Schema.optionalKey(Schema.String),
})
export type NewChat = typeof NewChat.Type

/** Every field optional — a settings/title patch from the composer.
 * `provider` may change too (switching the chat's agent mid-conversation);
 * the store drops the native session id when it does, since each CLI can only
 * resume its own sessions. */
export const UpdateChat = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  provider: Schema.optionalKey(ChatProviderKind),
  model: Schema.optionalKey(Schema.String),
  effort: Schema.optionalKey(ChatEffort),
  access: Schema.optionalKey(ChatAccess),
  mode: Schema.optionalKey(ChatMode),
})
export type UpdateChat = typeof UpdateChat.Type

/** An image the composer uploaded with a prompt. The full-resolution `data`
 * is decoded to a temp file whose path is handed to the agent CLI (mirroring
 * the terminal-threads drag-and-drop trick); `thumbnail` is a small data-URL
 * that gets persisted on the message for rendering the timeline preview. */
export const ChatImageUpload = Schema.Struct({
  name: Schema.String,
  /** Raw base64 (no `data:` prefix) of the full-resolution image. */
  data: Schema.String,
  /** A small `data:` URL preview, kept on the persisted message. */
  thumbnail: Schema.String,
})
export type ChatImageUpload = typeof ChatImageUpload.Type

export const SendChatMessage = Schema.Struct({
  text: Schema.String,
  images: Schema.optionalKey(Schema.Array(ChatImageUpload)),
})
export type SendChatMessage = typeof SendChatMessage.Type

export const ChatIdParam = Schema.Struct({ id: Schema.String })
