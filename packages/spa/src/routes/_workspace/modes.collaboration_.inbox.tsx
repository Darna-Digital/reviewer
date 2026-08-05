import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/interactions/inbox/components/inbox-page";

/** `compose=chat` swaps the thread pane for the new-chat composer. */
export interface InboxSearch {
  compose?: "chat";
}

// Trailing `_` keeps this out of the collaboration page's route, which renders
// its own workspace rather than an `<Outlet />`.
export const Route = createFileRoute("/_workspace/modes/collaboration_/inbox")({
  validateSearch: (search: Record<string, unknown>): InboxSearch => ({
    compose: search["compose"] === "chat" ? "chat" : undefined,
  }),
  component: InboxPage,
});
