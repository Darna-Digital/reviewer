import { createFileRoute } from "@tanstack/react-router";
import { ProjectsHome } from "@/interactions/collab/components/projects-home";

export const Route = createFileRoute("/_app/modes/collaboration/")({
  component: ProjectsHome,
});
