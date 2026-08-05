import * as Schema from "effect/Schema";

export const ChatProviderKind = Schema.Literals([
  "claude",
  "codex",
  "opencode",
  "cursor",
]);
export type ChatProviderKind = typeof ChatProviderKind.Type;
export const ChatEffort = Schema.Literals(["low", "medium", "high"]);
export type ChatEffort = typeof ChatEffort.Type;
export const ChatAccess = Schema.Literals([
  "supervised",
  "acceptEdits",
  "fullAccess",
]);
export type ChatAccess = typeof ChatAccess.Type;
export const ChatMode = Schema.Literals(["build", "plan"]);
export type ChatMode = typeof ChatMode.Type;
export const ChatTurnState = Schema.Literals([
  "running",
  "completed",
  "interrupted",
  "error",
]);
export type ChatTurnState = typeof ChatTurnState.Type;
export const ChatRole = Schema.Literals(["user", "assistant"]);
export type ChatRole = typeof ChatRole.Type;
export const ChatAttachment = Schema.Struct({
  name: Schema.String,
  thumbnail: Schema.String,
});
export type ChatAttachment = typeof ChatAttachment.Type;
export const ChatMessage = Schema.Struct({
  id: Schema.String,
  role: ChatRole,
  text: Schema.String,
  turnId: Schema.String,
  streaming: Schema.Boolean,
  createdAt: Schema.String,
  attachments: Schema.optionalKey(Schema.Array(ChatAttachment)),
  pending: Schema.optionalKey(Schema.Boolean),
});
export type ChatMessage = typeof ChatMessage.Type;
export const ChatActivity = Schema.Struct({
  id: Schema.String,
  turnId: Schema.String,
  kind: Schema.String,
  tone: Schema.Literals(["info", "tool", "error"]),
  summary: Schema.String,
  detail: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  /** The provider's tool-call id, pairing a `tool.started` with the
   * `tool.completed`/`tool.failed` that settles it. Optional: activities
   * persisted before this field existed (and non-tool activities) have none. */
  callId: Schema.optionalKey(Schema.String),
  /** Short label for the tool itself (`Bash`, `Read`), separate from the
   * one-line `summary` that also carries the command or path. */
  label: Schema.optionalKey(Schema.String),
});
export type ChatActivity = typeof ChatActivity.Type;
export const ChatTurn = Schema.Struct({
  id: Schema.String,
  state: ChatTurnState,
  startedAt: Schema.String,
  endedAt: Schema.NullOr(Schema.String),
  errorMessage: Schema.NullOr(Schema.String),
  totalCostUsd: Schema.NullOr(Schema.Number),
});
export type ChatTurn = typeof ChatTurn.Type;
export const Chat = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  provider: ChatProviderKind,
  model: Schema.String,
  effort: ChatEffort,
  access: ChatAccess,
  mode: ChatMode,
  branch: Schema.String,
  sessionId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  messages: Schema.Array(ChatMessage),
  activities: Schema.Array(ChatActivity),
  latestTurn: Schema.NullOr(ChatTurn),
});
export type Chat = typeof Chat.Type;
export const ChatSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  provider: ChatProviderKind,
  model: Schema.String,
  branch: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  messageCount: Schema.Number,
  lastMessage: Schema.NullOr(Schema.String),
  turnState: Schema.NullOr(ChatTurnState),
});
export type ChatSummary = typeof ChatSummary.Type;
export const ChatModel = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  /** The upstream vendor behind the model, when the agent runs models it did
   * not make — opencode brokers Bedrock, Copilot and its own hosted models
   * through one CLI, and the picker groups them under this. Absent for agents
   * that only offer their own models. */
  group: Schema.optionalKey(Schema.String),
});
export type ChatModel = typeof ChatModel.Type;
export const ChatModelProvider = Schema.Struct({
  id: ChatProviderKind,
  label: Schema.String,
  models: Schema.Array(ChatModel),
});
export type ChatModelProvider = typeof ChatModelProvider.Type;
export const ChatModelCatalog = Schema.Struct({
  providers: Schema.Array(ChatModelProvider),
  defaults: Schema.Struct({
    provider: ChatProviderKind,
    model: Schema.String,
    effort: ChatEffort,
    access: ChatAccess,
    mode: ChatMode,
  }),
});
export type ChatModelCatalog = typeof ChatModelCatalog.Type;
export const NewChat = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  provider: Schema.optionalKey(ChatProviderKind),
  model: Schema.optionalKey(Schema.String),
  effort: Schema.optionalKey(ChatEffort),
  access: Schema.optionalKey(ChatAccess),
  mode: Schema.optionalKey(ChatMode),
  branch: Schema.optionalKey(Schema.String),
});
export type NewChat = typeof NewChat.Type;
export const UpdateChat = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  provider: Schema.optionalKey(ChatProviderKind),
  model: Schema.optionalKey(Schema.String),
  effort: Schema.optionalKey(ChatEffort),
  access: Schema.optionalKey(ChatAccess),
  mode: Schema.optionalKey(ChatMode),
});
export type UpdateChat = typeof UpdateChat.Type;
export const ChatImageUpload = Schema.Struct({
  name: Schema.String,
  data: Schema.String,
  thumbnail: Schema.String,
});
export type ChatImageUpload = typeof ChatImageUpload.Type;
export const SendChatMessage = Schema.Struct({
  text: Schema.String,
  images: Schema.optionalKey(Schema.Array(ChatImageUpload)),
});
export type SendChatMessage = typeof SendChatMessage.Type;
export const ChatIdParam = Schema.Struct({ id: Schema.String });
export type ChatWireEvent =
  | {
      readonly type: "turn-started";
      readonly chat: Chat;
    }
  | {
      readonly type: "message-appended";
      readonly message: ChatMessage;
    }
  | {
      readonly type: "delta";
      readonly messageId: string;
      readonly text: string;
    }
  | {
      readonly type: "activity";
      readonly activity: ChatActivity;
    }
  | {
      readonly type: "turn-completed";
      readonly turn: ChatTurn;
      readonly messageId: string;
      readonly text: string;
    };
