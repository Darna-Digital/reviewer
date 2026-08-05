import { createFileRoute, notFound } from "@tanstack/react-router";
import { KitchenSinkPage } from "@/components/kitchen-sink/kitchen-sink-page";

/**
 * The design-system reference. It ships no product behaviour, so it is gated to
 * the dev server rather than being reachable in a packaged build.
 */
export const Route = createFileRoute("/kitchen-sink")({
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound();
  },
  component: KitchenSinkPage,
});
