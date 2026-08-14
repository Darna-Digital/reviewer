/**
 * The sessions surface with no conversation on it.
 *
 * Landing here is landing on the list: the surface used to resume the newest
 * session on the way in, so the one place that shows every conversation was a
 * place you could only reach by leaving the one it had chosen for you. Nothing
 * is opened and nothing is started — the list is beside this pane, and what to
 * read is the reader's to say.
 *
 * The composer is what `?new` is for, and only the rail's + asks for it.
 */
import { useSearch } from "@tanstack/react-router";
import { NewChatView } from "@/interactions/chats/components/new-chat-view";

export function SessionsIndex() {
  const startingNew = useSearch({ strict: false }).new === true;
  if (startingNew) return <NewChatView />;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-sm">
      <p className="font-medium">No session open</p>
      <p className="text-muted-foreground">
        Pick one from the list, or start a new session from the rail.
      </p>
    </div>
  );
}
