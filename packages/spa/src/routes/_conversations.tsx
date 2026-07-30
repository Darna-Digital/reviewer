import { createFileRoute } from "@tanstack/react-router"
import { ConversationShell } from "@/components/layout/conversation-shell"

/**
 * Pathless layout for the code side's non-diff pages — agent chats, review
 * comments, services and settings. It renders the shared mode rail + frame;
 * the matched child page fills the rest. (Projects, tasks and docs live on
 * the other surface entirely, at /workspace.)
 */
export const Route = createFileRoute("/_conversations")({
  component: ConversationShell,
})
