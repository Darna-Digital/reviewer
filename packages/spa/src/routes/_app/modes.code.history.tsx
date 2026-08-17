import { createFileRoute } from "@tanstack/react-router";

/**
 * Branch history, with the window to itself.
 *
 * There is nothing to render here, and that is the point: the history lives in
 * the dock, the dock lives in the layout above the outlet, and a location that
 * built a second copy of it down here would be a page that threw away the list's
 * place and its filters on the way in. So this route is the location and nothing
 * else — `AppLayout` reads it and gives the canvas to the dock. See `shellRoute`.
 */
export const Route = createFileRoute("/_app/modes/code/history")({
  component: () => null,
});
