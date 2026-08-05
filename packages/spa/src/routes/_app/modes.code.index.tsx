import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/modes/code/")({
  beforeLoad: () => {
    throw redirect({ to: "/modes/code/commit" })
  },
})
