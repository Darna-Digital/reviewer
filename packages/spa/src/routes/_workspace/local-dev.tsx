import { createFileRoute } from "@tanstack/react-router"
import { LocalDevPage } from "@/interactions/local-dev/components/local-dev-page"

export const Route = createFileRoute("/_workspace/local-dev")({
  component: LocalDevPage,
})
