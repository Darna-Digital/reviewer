import * as Schema from "effect/Schema";

export class ChatBusy extends Schema.TaggedErrorClass<ChatBusy>()(
  "ChatBusy",
  { chatId: Schema.String },
  { httpApiStatus: 409 }
) {
  // Effect's tagged errors use this getter as the human-readable response body.
  override get message(): string {
    return `chat ${this.chatId} is already running a turn — stop it first`;
  }
}
