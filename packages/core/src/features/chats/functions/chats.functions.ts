import type { Chat, ChatSummary } from "../schema/chats.schema.ts";

export const DEFAULT_CHAT_TITLE = "New thread";
export const summarizeChat = (chat: Chat): ChatSummary => {
  const last = chat.messages.at(-1);
  return {
    id: chat.id,
    title: chat.title,
    provider: chat.provider,
    model: chat.model,
    branch: chat.branch,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
    messageCount: chat.messages.length,
    lastMessage: last !== undefined ? last.text.slice(0, 120) : null,
    turnState: chat.latestTurn?.state ?? null,
  };
};
export const titleFromPrompt = (text: string): string => {
  const line = text.trim().split("\n", 1)[0] ?? "";
  return line.length > 60 ? `${line.slice(0, 59)}…` : line;
};
