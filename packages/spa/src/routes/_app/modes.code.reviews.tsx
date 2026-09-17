import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Where the merge requests were listed before git had a mode of its own.
 * Kept as an address, for the links and the pinned tabs that still name it.
 */
export const Route = createFileRoute("/_app/modes/code/reviews")({
  beforeLoad: () => {
    throw redirect({ to: "/modes/git", search: { tab: "reviews" } });
  },
});
