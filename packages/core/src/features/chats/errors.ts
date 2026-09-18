import * as Schema from "effect/Schema";

export class ChatBusy extends Schema.TaggedError<ChatBusy>()(
  "ChatBusy",
  { chatId: Schema.String },
  { httpApiStatus: 409 }
) {
  override get message(): string {
    return `chat ${this.chatId} is already running a turn — stop it first`;
  }
}
