import { createFileRoute } from "@tanstack/react-router";
import { CodeWorkspace } from "@/components/code-workspace";

/**
 * One worktree, read in the diff view. A splat rather than a named param
 * because the branch that identifies it holds slashes.
 */
export const Route = createFileRoute("/_app/modes/code/review/worktree/$")({
  component: CodeWorkspace,
});
