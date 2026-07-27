import { createFileRoute } from "@tanstack/react-router"
import { CommentsPage } from "@/interactions/comments/components/comments-page"

export const Route = createFileRoute("/_workspace/comments")({
  component: CommentsPage,
})
