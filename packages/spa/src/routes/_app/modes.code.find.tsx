import { createFileRoute } from "@tanstack/react-router";

/**
 * The Find window, with the window to itself.
 *
 * Nothing renders here, as on the other dock pages: the results live in the
 * dock, the dock lives in the layout above the outlet, and a second copy built
 * down here would be a page that threw away the tree's folds and its selection
 * on the way in. So this route is the location and nothing else — `AppLayout`
 * reads it and gives the canvas to the dock. See `shellRoute`.
 */
export const Route = createFileRoute("/_app/modes/code/find")({
  component: () => null,
});
