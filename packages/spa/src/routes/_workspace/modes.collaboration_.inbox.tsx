import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/interactions/inbox/components/inbox-page";

// Trailing `_` keeps this out of the collaboration page's route, which renders
// its own workspace rather than an `<Outlet />`.
export const Route = createFileRoute("/_workspace/modes/collaboration_/inbox")({
  component: InboxPage,
});
