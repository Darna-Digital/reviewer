import { createFileRoute } from "@tanstack/react-router"
import { NewChatPage } from "@/interactions/collaboration/components/new-chat-page"

export const Route = createFileRoute("/_workspace/new-chat")({
  component: NewChatPage,
})
