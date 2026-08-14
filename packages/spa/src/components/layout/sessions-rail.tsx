/**
 * SessionsRail — the sessions surface's left rail: everything that acts on the
 * list, rather than on the conversation beside it — minting a session, finding
 * one, and narrowing which of them the list holds.
 *
 * They were in the toolbar, which left the sessions surface a rail short of
 * every code page: crossing between the two slid the whole window sideways by
 * the rail's width, and back again on the way out. Same controls, same column,
 * at the size the rail sets for all of them — so what changes on the way across
 * is the icons in the rail rather than the page beside it.
 */
import { Rail } from "@/components/layout/rail";
import { NewSessionButton } from "@/interactions/chats/components/new-session-button";
import { SessionFilters } from "@/interactions/chats/components/session-filters";
import { SessionSearch } from "@/interactions/chats/components/session-search";

export function SessionsRail() {
  return (
    <Rail label="Sessions">
      <NewSessionButton />
      <SessionSearch />
      <SessionFilters />
    </Rail>
  );
}
