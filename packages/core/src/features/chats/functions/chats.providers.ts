import type { ChatProviderKind } from "../schema/chats.schema.ts";

/**
 * Where a chat's native session id comes from — the thing that decides whether
 * a chat can be resumed, and how. It differs per agent CLI, so the runtime that
 * spawns them has to branch on it; the rule itself is about the agents, not
 * about processes, so it lives here and the server only acts on it.
 *
 *   minted      we choose the id and hand it to the CLI on its first turn, so
 *               the chat is resumable from the moment it starts (claude).
 *   announced   the CLI mints its own and names it on its event stream, which
 *               the turn parser surfaces as a `session` event (cursor).
 *   discovered  the CLI mints its own and can't be relied on to say so, so the
 *               id has to be read back from the session files it writes
 *               (opencode never announces; older codex builds don't either).
 *
 * A `session` event is always honoured, whatever the origin — `discovered`
 * only means the runtime must also go looking when none arrives.
 */
export type ChatSessionOrigin = "minted" | "announced" | "discovered";

export const chatSessionOrigin = (
  provider: ChatProviderKind
): ChatSessionOrigin => {
  switch (provider) {
    case "claude":
      return "minted";
    case "cursor":
      return "announced";
    case "codex":
    case "opencode":
      return "discovered";
  }
};
