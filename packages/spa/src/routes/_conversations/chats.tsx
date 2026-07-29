import { createFileRoute } from "@tanstack/react-router"
import { ChatsPage } from "@/interactions/chats/components/chats-page"

export const Route = createFileRoute("/_conversations/chats")({
  component: ChatsPage,
})
