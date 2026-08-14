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
/**
 * Where a chat lives. Sessions are stored centrally rather than per
 * repository, so every one of them carries the repository its agent runs in
 * and the project that repository was opened under — which is what lets the
 * sessions list show all projects at once and filter down to one.
 */
export const ChatOrigin = Schema.Struct({
  /** The project folder, which may hold several repositories. */
  projectPath: Schema.String,
  projectName: Schema.String,
  /** The git root the agent's process runs in. */
  repoPath: Schema.String,
  /** Project-relative name, so a nested root reads as `apps/web`. */
  repoName: Schema.String,
});
export type ChatOrigin = typeof ChatOrigin.Type;
export const Chat = Schema.Struct({
  id: Schema.String,
  origin: ChatOrigin,
  title: Schema.String,
  provider: ChatProviderKind,
  model: Schema.String,
  effort: ChatEffort,
  access: ChatAccess,
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
  origin: ChatOrigin,
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

/**
 * What the sessions list asks for: a window of the conversations, newest first,
 * already narrowed to what the reader is looking at.
 *
 * The filters travel with the page rather than being applied to it afterwards.
 * A list that arrives a page at a time can only be filtered by whoever holds
 * all of it, and that is the database — narrowing in the client would search
 * the pages fetched so far and quietly call that the answer.
 *
 * Every field is a string because these are URL parameters; the store parses
 * them. `cursor` is opaque to the client: it hands back whatever the last page
 * gave it.
 */
export const ChatListQuery = Schema.Struct({
  limit: Schema.optionalKey(Schema.String),
  cursor: Schema.optionalKey(Schema.String),
  /** Matches title, last message, and the project's name. */
  q: Schema.optionalKey(Schema.String),
  /** A project's absolute path; absent means every project. */
  project: Schema.optionalKey(Schema.String),
  /** ISO timestamp — only sessions touched at or after it. */
  since: Schema.optionalKey(Schema.String),
});
export type ChatListQuery = typeof ChatListQuery.Type;

/**
 * A page of sessions. `nextCursor` is null at the end of the list, which is the
 * only thing that tells the client to stop: a short page does not mean the end
 * when the database is filtering.
 */
export const ChatPage = Schema.Struct({
  items: Schema.Array(ChatSummary),
  nextCursor: Schema.NullOr(Schema.String),
});
export type ChatPage = typeof ChatPage.Type;

/**
 * A project the sessions list can be narrowed to, and how many it holds. Drawn
 * from every session rather than from the loaded pages, so the menu offers the
 * same projects however far the reader has scrolled.
 */
export const ChatProjectTally = Schema.Struct({
  /** The project folder's absolute path — the filter's value. */
  path: Schema.String,
  name: Schema.String,
  count: Schema.Number,
});
export type ChatProjectTally = typeof ChatProjectTally.Type;

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
  }),
});
export type ChatModelCatalog = typeof ChatModelCatalog.Type;
export const NewChat = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  provider: Schema.optionalKey(ChatProviderKind),
  model: Schema.optionalKey(Schema.String),
  effort: Schema.optionalKey(ChatEffort),
  access: Schema.optionalKey(ChatAccess),
  branch: Schema.optionalKey(Schema.String),
});
export type NewChat = typeof NewChat.Type;
export const UpdateChat = Schema.Struct({
  title: Schema.optionalKey(Schema.String),
  provider: Schema.optionalKey(ChatProviderKind),
  model: Schema.optionalKey(Schema.String),
  effort: Schema.optionalKey(ChatEffort),
  access: Schema.optionalKey(ChatAccess),
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
