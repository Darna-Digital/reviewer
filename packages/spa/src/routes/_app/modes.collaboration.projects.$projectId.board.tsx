import { createFileRoute, useParams } from "@tanstack/react-router";
import { BoardPage } from "@/interactions/collab/components/board-page";

function BoardRoute() {
  const { projectId } = useParams({
    from: "/_app/modes/collaboration/projects/$projectId/board",
  });
  return <BoardPage projectId={projectId} />;
}

export const Route = createFileRoute(
  "/_app/modes/collaboration/projects/$projectId/board"
)({
  component: BoardRoute,
});
