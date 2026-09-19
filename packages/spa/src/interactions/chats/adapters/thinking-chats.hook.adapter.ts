/**
 * Which conversations have an agent working in them right now.
 *
 * Read from the sessions list rather than from each chat's own socket: the
 * strip and the sidebar both need to know about threads they are not showing,
 * and the list already mirrors turn state — `useChatStream`
 * refreshes it whenever a turn starts or settles.
 */
import { useMemo } from "react";
import { useRecentChats } from "@/lib/queries";

export function useThinkingChatIds(): ReadonlySet<string> {
  const chats = useRecentChats();
  const items = chats.data?.items;
  return useMemo(
    () =>
      new Set(
        (items ?? [])
          .filter((chat) => chat.turnState === "running")
          .map((chat) => chat.id)
      ),
    [items]
  );
}
