import { createFileRoute } from "@tanstack/react-router"
import { TasksPage } from "@/interactions/tasks/components/tasks-page"

export const Route = createFileRoute("/_workspace/tasks")({
  component: TasksPage,
})
