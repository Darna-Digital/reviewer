import { createFileRoute } from "@tanstack/react-router";
import { SessionsIndex } from "@/interactions/chats/components/sessions-index";

/** Whether to show the new-session composer instead of the list's empty pane. */
export interface ChatsIndexSearch {
  new?: boolean;
}

export const Route = createFileRoute("/_app/modes/agent-session/")({
  validateSearch: (search: Record<string, unknown>): ChatsIndexSearch => ({
    new: search["new"] === true || search["new"] === "true" ? true : undefined,
  }),
  component: SessionsIndex,
});
