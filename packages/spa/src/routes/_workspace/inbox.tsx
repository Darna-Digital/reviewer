import { createFileRoute } from "@tanstack/react-router"
import { InboxPage } from "@/interactions/inbox/components/inbox-page"

/** `compose=chat` swaps the thread pane for the new-chat composer. */
export interface InboxSearch {
  compose?: "chat"
}

export const Route = createFileRoute("/_workspace/inbox")({
  validateSearch: (search: Record<string, unknown>): InboxSearch => ({
    compose: search["compose"] === "chat" ? "chat" : undefined,
  }),
  component: InboxPage,
})
