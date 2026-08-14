import { createFileRoute } from "@tanstack/react-router";
import { TasksPage } from "@/interactions/tasks/components/tasks-page";

export const Route = createFileRoute("/_app/modes/code/tasks")({
  component: TasksPage,
});
