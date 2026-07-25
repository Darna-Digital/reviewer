import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"
import { openBottomTab } from "@/lib/ui-prefs"

/** Legacy /threads route — opens the Threads bottom-dock tab. */
export const Route = createFileRoute("/_workspace/threads")({
  component: OpenThreadsTab,
})

function OpenThreadsTab() {
  const navigate = useNavigate()
  useEffect(() => {
    openBottomTab("threads")
    void navigate({ to: "/commit", replace: true })
  }, [navigate])
  return null
}
