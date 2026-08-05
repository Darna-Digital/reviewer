import { createFileRoute } from "@tanstack/react-router";

// Review a single GitHub pull request. `pull` (number) is a typed path param.
export const Route = createFileRoute("/_app/modes/code/review/$pull")({
  component: () => null,
});
