import { createFileRoute } from "@tanstack/react-router";
import { CodeWorkspace } from "@/components/code-workspace";

// Browse a single commit's diff. `sha` is a typed path param read by AppShell.
export const Route = createFileRoute("/_app/modes/code/browse/commit/$sha")({
  component: CodeWorkspace,
});
