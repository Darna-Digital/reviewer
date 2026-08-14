import { createFileRoute } from "@tanstack/react-router";
import { CodeWorkspace } from "@/components/code-workspace";

export const Route = createFileRoute("/_app/modes/code/browse/")({
  component: CodeWorkspace,
});
