import { createFileRoute } from "@tanstack/react-router";
import { CodeWorkspace } from "@/components/code-workspace";

// Commit mode — the worktree diff + commit panel are rendered by AppShell,
// which reads the active route to know the mode. This route just defines the URL.
export const Route = createFileRoute("/_app/modes/code/commit")({
  component: CodeWorkspace,
});
