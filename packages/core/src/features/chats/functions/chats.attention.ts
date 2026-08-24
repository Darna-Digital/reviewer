/**
 * What a session is allowed to say for itself in a list — the rule behind the
 * two dots on a row in the sessions sidebar, the inbox popover's mark, and the
 * window bar's tabs.
 *
 * Both dots ask the same question of `seenAt`: has this session moved since the
 * reader last had it open? That mark lives on the session, so opening the
 * conversation answers it — the earlier design kept one stamp for the whole
 * inbox, which meant a session you had just read went on waving until you left
 * the surface and came back.
 *
 * A turn's own state is not enough either. `interrupted` and `error` are where
 * a turn stops for good: nothing later rewrites them, so a row that showed the
 * outcome once showed it forever, however many times the session was opened.
 * An outcome is news until it has been read; a running turn is news the whole
 * time it runs.
 */
import type { ChatTurnState } from "../schema/chats.schema.ts";

/** What "has it moved?" is asked of — a summary in the list, or a chat in hand. */
export interface ChatSeenState {
  readonly updatedAt: string;
  readonly seenAt: string | null;
}

/** The same, plus how its last turn ended. */
export interface ChatAttentionState extends ChatSeenState {
  readonly turnState: ChatTurnState | null;
}

/** Has the session been touched since the reader last had it open? */
export function isChatUnread(chat: ChatSeenState): boolean {
  const updated = Date.parse(chat.updatedAt);
  if (Number.isNaN(updated)) return false;
  if (chat.seenAt === null) return true;
  const seen = Date.parse(chat.seenAt);
  return Number.isNaN(seen) || updated > seen;
}

export function unreadChatCount(chats: ReadonlyArray<ChatSeenState>): number {
  return chats.filter(isChatUnread).length;
}

/**
 * The turn state a row should show, or `null` for a row with nothing to say.
 *
 * A running turn always shows — that is the session working in front of you.
 * A turn that ended badly shows until the session has been opened since, and a
 * turn that simply finished never shows at all.
 */
export function unattendedTurnState(
  chat: ChatAttentionState
): ChatTurnState | null {
  if (chat.turnState === null || chat.turnState === "completed") return null;
  if (chat.turnState === "running") return "running";
  return isChatUnread(chat) ? chat.turnState : null;
}
