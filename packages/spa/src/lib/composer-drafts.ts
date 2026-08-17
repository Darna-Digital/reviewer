/**
 * Composer drafts — the unsent prompt text for each chat, keyed by chat id,
 * with `NEW_CHAT_DRAFT` for the not-yet-created thread on the /chats index.
 * Entries clear on send.
 */
import { makeDraftStore } from "@/lib/drafts";

/** Draft key for the new-thread composer on the /chats index. */
export const NEW_CHAT_DRAFT = "new";

export const { setDraft, useDraft } = makeDraftStore("byconvo-chat-drafts");
