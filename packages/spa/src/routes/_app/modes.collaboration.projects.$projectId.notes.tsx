import { createFileRoute, useParams } from "@tanstack/react-router";
import { NotesPage } from "@/interactions/collab/components/notes-page";

export interface NotesSearch {
  /** Which note is open. In the URL because a note is somewhere you have gone. */
  note?: string;
}

function NotesRoute() {
  const { projectId } = useParams({
    from: "/_app/modes/collaboration/projects/$projectId/notes",
  });
  return <NotesPage projectId={projectId} />;
}

export const Route = createFileRoute(
  "/_app/modes/collaboration/projects/$projectId/notes"
)({
  validateSearch: (search: Record<string, unknown>): NotesSearch =>
    typeof search["note"] === "string" ? { note: search["note"] } : {},
  component: NotesRoute,
});
