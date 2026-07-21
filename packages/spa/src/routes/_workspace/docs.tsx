import { createFileRoute } from "@tanstack/react-router"
import { DocsPage } from "@/interactions/docs/components/docs-page"

export const Route = createFileRoute("/_workspace/docs")({
  component: DocsPage,
})
