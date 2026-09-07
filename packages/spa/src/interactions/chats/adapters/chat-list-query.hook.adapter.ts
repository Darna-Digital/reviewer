/**
 * The stored filters as the query the sessions list is fetched with.
 *
 * Two surfaces ask the same question of the same list — the list itself, and
 * the pane beside it working out which session to open on the way in — and they
 * must ask it identically: the filtered page is shared by query key, so a
 * second reading of the filters that landed anywhere else would fetch a second
 * list and open a session that is not the one at the top of the one on screen.
 */
import { useMemo } from "react";
import { useChatFilters } from "@/interactions/chats/adapters/chat-filters.store";
import {
  chatListFilters,
  resolveProjectFilter,
} from "@/interactions/chats/functions/chat-filters.functions";
import { useChatProjects } from "@/lib/queries";
import type { ChatListFilters } from "@/lib/queries";
import type { ChatProjectTally } from "@reviewer/core/chats";

const EMPTY_PROJECTS: ReadonlyArray<ChatProjectTally> = [];

export function useChatListQuery(): ChatListFilters {
  // Over every session rather than over the pages loaded so far: a project the
  // reader has not scrolled to is still a project they can narrow to.
  const projects = useChatProjects().data ?? EMPTY_PROJECTS;
  const stored = useChatFilters();
  const project = resolveProjectFilter(projects, stored.project);
  return useMemo(
    () => chatListFilters(project, stored.date),
    [project, stored.date]
  );
}
