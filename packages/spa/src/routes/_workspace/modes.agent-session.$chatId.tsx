import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/interactions/chats/components/chat-view";
import { chatQueryOptions } from "@/lib/queries";

export const Route = createFileRoute("/_workspace/modes/agent-session/$chatId")(
  {
    // Warms the cache the live view seeds itself from, so a session opened from
    // anywhere — a tab, a crumb, search — has its conversation ready by the time
    // the click lands (preloading is on intent). Deliberately not awaited: a
    // session never opened before should show its stream arriving, not hold the
    // conversation you are still looking at while a fetch runs.
    loader: ({ context, params }) => {
      void context.queryClient
        .ensureQueryData(chatQueryOptions(params.chatId))
        .catch(() => null);
    },
    component: ChatRoute,
  }
);

function ChatRoute() {
  const { chatId } = Route.useParams();
  // Keyed so switching threads resets the stream/composer state cleanly.
  return <ChatView key={chatId} chatId={chatId} />;
}
