import { createFileRoute, useParams } from "@tanstack/react-router";
import { ProjectHome } from "@/interactions/collab/components/project-home";

function ProjectRoute() {
  const { projectId } = useParams({
    from: "/_app/modes/collaboration/projects/$projectId/",
  });
  return <ProjectHome projectId={projectId} />;
}

export const Route = createFileRoute(
  "/_app/modes/collaboration/projects/$projectId/"
)({
  component: ProjectRoute,
});
