import { createFileRoute } from "@tanstack/react-router";
import { ReviewsPage } from "@/interactions/reviews/components/reviews-page";

export const Route = createFileRoute("/_app/modes/code/reviews")({
  component: ReviewsPage,
});
