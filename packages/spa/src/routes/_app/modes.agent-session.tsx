import { createFileRoute } from "@tanstack/react-router";
import { ChatsPage } from "@/interactions/chats/components/chats-page";

export const Route = createFileRoute("/_app/modes/agent-session")({
  component: ChatsPage,
});
