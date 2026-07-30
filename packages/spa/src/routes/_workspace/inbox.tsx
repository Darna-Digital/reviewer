import { createFileRoute } from "@tanstack/react-router"
import { InboxPage } from "@/interactions/inbox/components/inbox-page"

export const Route = createFileRoute("/_workspace/inbox")({
  component: InboxPage,
})
