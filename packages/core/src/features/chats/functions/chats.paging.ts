/**
 * Paging the sessions list.
 *
 * The list is ordered by when a session was last touched, and that order moves
 * under the reader: a turn landing in any session lifts it to the top while
 * they are scrolled somewhere in the middle. Counting rows to skip is wrong for
 * a list like that — everything below the moved row shifts up by one, so the
 * next page starts one row late and a session is silently never shown. So a
 * page says where it ended and the next one resumes from there: the row is
 * named, not counted, and a reorder can only ever repeat a row rather than hide
 * one.
 *
 * `updatedAt` alone is not a position — two sessions can share a timestamp to
 * the millisecond — so the id rides along as the tiebreak, and both the cursor
 * and the sort are over the pair.
 *
 * Pure, and shared by both stores, so the SQL and the in-memory list page and
 * filter by the same rules.
 */
import type { ChatListQuery, ChatSummary } from "../schema/chats.schema.ts";
import type { ListChatsInput } from "../repository/chats.repository.ts";

export const DEFAULT_CHAT_PAGE_SIZE = 30;
/** What a caller may ask for at most, however large a `limit` arrives. */
export const MAX_CHAT_PAGE_SIZE = 100;

export interface ChatCursor {
  readonly updatedAt: string;
  readonly id: string;
}

/** Where a page ended, as the one string the client hands back. */
export const encodeChatCursor = (position: ChatCursor): string =>
  `${position.updatedAt}|${position.id}`;

/** A cursor that isn't one is treated as no cursor: a client asking from a
 * position we can't read gets the start of the list, not an error. */
export const decodeChatCursor = (cursor: string | null): ChatCursor | null => {
  if (cursor === null) return null;
  const separator = cursor.indexOf("|");
  if (separator <= 0) return null;
  const id = cursor.slice(separator + 1);
  return id.length === 0 ? null : { updatedAt: cursor.slice(0, separator), id };
};

const trimmed = (value: string | undefined): string | null => {
  const text = value?.trim() ?? "";
  return text.length > 0 ? text : null;
};

/** The URL's strings as the store's input, with `limit` held to its ceiling. */
export const parseChatListQuery = (query: ChatListQuery): ListChatsInput => {
  const asked = Number(query.limit);
  return {
    limit: Number.isFinite(asked)
      ? Math.min(MAX_CHAT_PAGE_SIZE, Math.max(1, Math.trunc(asked)))
      : DEFAULT_CHAT_PAGE_SIZE,
    cursor: trimmed(query.cursor),
    search: trimmed(query.q),
    projectPath: trimmed(query.project),
    since: trimmed(query.since),
  };
};

/** Newest first, the id breaking ties so the order is total. */
export const byRecency = (a: ChatSummary, b: ChatSummary): number =>
  a.updatedAt === b.updatedAt
    ? b.id.localeCompare(a.id)
    : b.updatedAt.localeCompare(a.updatedAt);

/** Whether a session sits strictly after `position` in that order. */
export const isAfterCursor = (
  chat: ChatSummary,
  position: ChatCursor
): boolean =>
  chat.updatedAt === position.updatedAt
    ? chat.id.localeCompare(position.id) < 0
    : chat.updatedAt.localeCompare(position.updatedAt) < 0;

/** The same three fields the SQL search covers. */
export const matchesChatSearch = (
  chat: ChatSummary,
  search: string
): boolean => {
  const needle = search.toLowerCase();
  return (
    chat.title.toLowerCase().includes(needle) ||
    (chat.lastMessage ?? "").toLowerCase().includes(needle) ||
    chat.origin.projectName.toLowerCase().includes(needle)
  );
};

export const matchesChatFilters = (
  chat: ChatSummary,
  input: ListChatsInput
): boolean =>
  (input.projectPath === null ||
    chat.origin.projectPath === input.projectPath) &&
  (input.since === null || chat.updatedAt >= input.since) &&
  (input.search === null || matchesChatSearch(chat, input.search));
