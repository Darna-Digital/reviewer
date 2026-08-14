import { createFileRoute } from "@tanstack/react-router";
import { DocsPage } from "@/interactions/docs/components/docs-page";

export const Route = createFileRoute("/_app/modes/code/docs")({
  component: DocsPage,
});
