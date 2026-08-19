import { createFileRoute, redirect } from "@tanstack/react-router";
import { REVIEW_HREF } from "@/lib/shell-route";

export const Route = createFileRoute("/_app/")({
  beforeLoad: () => {
    throw redirect({ to: REVIEW_HREF });
  },
});
