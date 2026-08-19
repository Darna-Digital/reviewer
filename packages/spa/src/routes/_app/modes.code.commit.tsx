import { createFileRoute, redirect } from "@tanstack/react-router";
import { REVIEW_HREF } from "@/lib/shell-route";

/**
 * Where the local changes used to live. They are a source of the diff view now
 * rather than a mode of their own, so this only forwards — bookmarks, restored
 * window tabs and old preview links all still land somewhere.
 */
export const Route = createFileRoute("/_app/modes/code/commit")({
  beforeLoad: () => {
    throw redirect({ to: REVIEW_HREF });
  },
});
