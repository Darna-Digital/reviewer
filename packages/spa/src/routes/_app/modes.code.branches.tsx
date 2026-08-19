import { createFileRoute } from "@tanstack/react-router";

/**
 * Branch management with the window to itself. The live surface belongs to the
 * shared dock above the outlet, so expanding it preserves its search, sections
 * and dialogs instead of building a second branch manager here.
 */
export const Route = createFileRoute("/_app/modes/code/branches")({
  component: () => null,
});
