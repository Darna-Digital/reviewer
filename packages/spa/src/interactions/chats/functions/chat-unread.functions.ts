/**
 * Unread in code mode's inbox is "touched since you last looked". The server
 * keeps no per-reader read state, so the inbox stamps the moment it was last
 * opened and every thread newer than that mark counts as waiting.
 */
import type { ChatSummary } from "@byconvo/core/chats"

export function isChatUnread(chat: ChatSummary, seenAt: string): boolean {
  const updated = Date.parse(chat.updatedAt)
  if (Number.isNaN(updated)) return false
  const seen = Date.parse(seenAt)
  return Number.isNaN(seen) || updated > seen
}

export function unreadChatCount(
  chats: ReadonlyArray<ChatSummary>,
  seenAt: string
): number {
  return chats.filter((chat) => isChatUnread(chat, seenAt)).length
}
