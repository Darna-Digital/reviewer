import { createFileRoute, redirect } from "@tanstack/react-router";
import { NewChatView } from "@/interactions/chats/components/new-chat-view";
import { recentChatsOptions } from "@/lib/queries";

/** Whether to force the new-thread composer instead of resuming a chat. */
export interface ChatsIndexSearch {
  new?: boolean;
}

export const Route = createFileRoute("/_app/modes/agent-session/")({
  validateSearch: (search: Record<string, unknown>): ChatsIndexSearch => ({
    new: search["new"] === true || search["new"] === "true" ? true : undefined,
  }),
  loaderDeps: ({ search }) => ({ forceNew: search.new === true }),
  // Resume the most recent session by redirecting to it, so entering Sessions
  // (from another mode, a deep link, or a reload) picks up where you left off.
  // The redirect runs before render — no composer flash — and is skipped when
  // `?new` asks for a fresh session or there are no sessions yet.
  loader: async ({ context, deps }) => {
    if (deps.forceNew) return;
    const recent =
      await context.queryClient.ensureQueryData(recentChatsOptions());
    // The list arrives newest-first, so the first page's first row is the one.
    const latest = recent.items[0];
    if (latest) {
      throw redirect({
        to: "/modes/agent-session/$chatId",
        params: { chatId: latest.id },
        replace: true,
      });
    }
  },
  component: NewChatView,
});
