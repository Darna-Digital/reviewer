import { createFileRoute } from "@tanstack/react-router";
import { CodeWorkspace } from "@/components/code-workspace";

/** One pull or merge request, read in the diff view. */
export const Route = createFileRoute("/_app/modes/code/review/pull/$number")({
  component: CodeWorkspace,
});
