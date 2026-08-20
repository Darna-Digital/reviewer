import { createFileRoute, useParams } from "@tanstack/react-router";
import { TodosPage } from "@/interactions/collab/components/todos-page";

function TodosRoute() {
  const { projectId } = useParams({
    from: "/_app/modes/collaboration/projects/$projectId/todos",
  });
  return <TodosPage projectId={projectId} />;
}

export const Route = createFileRoute(
  "/_app/modes/collaboration/projects/$projectId/todos"
)({
  component: TodosRoute,
});
