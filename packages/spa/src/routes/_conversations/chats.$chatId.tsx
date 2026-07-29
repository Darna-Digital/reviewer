import { createFileRoute } from "@tanstack/react-router"
import { ChatView } from "@/interactions/chats/components/chat-view"

export const Route = createFileRoute("/_conversations/chats/$chatId")({
  component: ChatRoute,
})

function ChatRoute() {
  const { chatId } = Route.useParams()
  // Keyed so switching threads resets the stream/composer state cleanly.
  return <ChatView key={chatId} chatId={chatId} />
}
