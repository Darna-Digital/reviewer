import { createFileRoute } from "@tanstack/react-router";

/**
 * Services, with the window to itself. Rendered by the dock in the layout rather
 * than from here — a second copy would be a second set of running commands. See
 * `modes.code.history` and `shellRoute`.
 */
export const Route = createFileRoute("/_app/modes/code/local-dev")({
  component: () => null,
});
