import { createFileRoute } from "@tanstack/react-router"
import { ThreadsPage } from "@/interactions/threads/components/threads-page"

export const Route = createFileRoute("/_workspace/threads")({
  component: ThreadsPage,
})
