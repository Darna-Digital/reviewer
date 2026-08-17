import { createFileRoute } from "@tanstack/react-router";

/**
 * Terminals, with the window to itself. Rendered by the dock in the layout rather
 * than from here — a second copy would be a second set of PTYs. See
 * `modes.code.history` and `shellRoute`.
 */
export const Route = createFileRoute("/_app/modes/code/threads")({
  component: () => null,
});
