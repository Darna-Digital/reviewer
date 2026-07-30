import { createFileRoute } from "@tanstack/react-router"
import { CollaborationPage } from "@/interactions/collaboration/components/collaboration-page"
import type { CollaborationView } from "@/interactions/collaboration/data/collaboration.mock"

const VIEWS: ReadonlyArray<CollaborationView> = [
  "project",
  "tasks",
  "docs",
  "channel",
  "task",
  "agents",
  "members",
]

export interface CollaborationSearch {
  view?: CollaborationView
  id?: string
}

export const Route = createFileRoute("/_workspace/modes/collaboration")({
  validateSearch: (search: Record<string, unknown>): CollaborationSearch => ({
    view: VIEWS.includes(search["view"] as CollaborationView)
      ? (search["view"] as CollaborationView)
      : undefined,
    id: typeof search["id"] === "string" ? search["id"] : undefined,
  }),
  component: CollaborationPage,
})
