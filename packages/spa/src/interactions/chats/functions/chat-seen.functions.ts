/**
 * When the session in front of the reader is worth marking as looked at.
 *
 * The mark is what settles the row's dots, so it has to move at every point the
 * reader can be said to have seen where the conversation got to: opening it,
 * and again each time a turn comes to rest under them. Nothing in between — a
 * turn streaming into a session you are watching is not a new thing to have
 * seen, and marking it token by token would be a write per frame.
 *
 * Expressed as a key rather than a boolean so the caller can simply send when
 * it changes: two visits to the same resting point produce the same key, and
 * the second one is not sent.
 */
import type { Chat } from "@reviewer/core/chats";

export const chatSeenMark = (chat: Chat | null): string | null =>
  chat === null
    ? null
    : `${chat.id}:${
        chat.latestTurn?.state === "running" ? "running" : chat.updatedAt
      }`;
