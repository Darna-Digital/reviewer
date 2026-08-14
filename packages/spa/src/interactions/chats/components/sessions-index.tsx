/**
 * The sessions surface with no conversation on it yet.
 *
 * Which is a moment rather than a page: the list beside it opens its newest
 * session as soon as the first page is in (see `ChatsPage`), so this is what is
 * behind that — the wait, and the case where there is nothing to open because
 * the filters leave nothing or nothing has been started. Neither of those is a
 * reason to mint a session, so nothing here does.
 *
 * The composer is what `?new` is for, and only the rail's + asks for it.
 */
import { useSearch } from "@tanstack/react-router";
import { useChatListQuery } from "@/interactions/chats/adapters/chat-list-query.hook.adapter";
import { NewChatView } from "@/interactions/chats/components/new-chat-view";
import { useChatPages } from "@/lib/queries";

export function SessionsIndex() {
  const startingNew = useSearch({ strict: false }).new === true;
  const filters = useChatListQuery();
  // The list's own page, by the same key — this reads the fetch it already
  // started rather than starting a second one.
  const { sessions, loading } = useChatPages(filters, !startingNew);

  if (startingNew) return <NewChatView />;
  // Empty until the list has answered: a page that says there is nothing here
  // and then opens a session is a page that was wrong for as long as it showed.
  if (loading || sessions.length > 0) return null;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-sm">
      <div className="font-medium">No sessions here</div>
      <div className="text-muted-foreground">
        Start one with + in the rail, or widen the filters beside it.
      </div>
    </div>
  );
}
