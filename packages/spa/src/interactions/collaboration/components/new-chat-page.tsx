/**
 * The new-chat surface as a page of its own, so starting a chat keeps you in
 * whichever mode you were in. Collaboration keeps its sidebar; code mode leans
 * on the rail.
 */
import { useRouterState } from "@tanstack/react-router"
import { CollaborationSidebar } from "@/interactions/collaboration/components/collaboration-sidebar"
import { NewChatView } from "@/interactions/collaboration/components/new-chat-view"
import { useUiPrefs } from "@/lib/ui-prefs"
import { activeWorkMode } from "@/lib/work-mode"

export function NewChatPage() {
  const { workMode } = useUiPrefs()
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <div className="flex h-full min-h-0">
      {activeWorkMode(pathname, workMode) === "collaboration" && (
        <CollaborationSidebar />
      )}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <NewChatView />
      </section>
    </div>
  )
}
