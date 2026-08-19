import { createFileRoute, redirect } from "@tanstack/react-router";

/** The old bare-number pull request URL, forwarded to the one that says so. */
export const Route = createFileRoute("/_app/modes/code/review/$pull")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/modes/code/review/pull/$number",
      params: { number: params.pull },
    });
  },
});
