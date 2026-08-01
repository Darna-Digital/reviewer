import { createFileRoute, redirect } from "@tanstack/react-router"
import { NewChatView } from "@/interactions/chats/components/new-chat-view"
import { api } from "@/lib/api/client"

/** Whether to force the new-thread composer instead of resuming a chat. */
export interface ChatsIndexSearch {
  new?: boolean
}

export const Route = createFileRoute("/_workspace/modes/code/chats/")({
  validateSearch: (search: Record<string, unknown>): ChatsIndexSearch => ({
    new: search["new"] === true || search["new"] === "true" ? true : undefined,
  }),
  loaderDeps: ({ search }) => ({ forceNew: search.new === true }),
  // Resume the most recent chat on the current branch by redirecting to it, so
  // entering Chats (from another mode, a deep link, or a reload) picks up where
  // you left off. The redirect runs before render — no composer flash — and is
  // skipped when `?new` asks for a fresh thread or the branch has no chats yet.
  loader: async ({ context, deps }) => {
    if (deps.forceNew) return
    const [chats, repo] = await Promise.all([
      context.queryClient.ensureQueryData(
        api.queryOptions("get", "/api/chats")
      ),
      context.queryClient.ensureQueryData(api.queryOptions("get", "/api/repo")),
    ])
    // The chats list is already sorted newest-first by the server.
    const latest = chats.find((c) => c.branch === (repo.currentBranch ?? ""))
    if (latest) {
      throw redirect({
        to: "/modes/code/chats/$chatId",
        params: { chatId: latest.id },
        replace: true,
      })
    }
  },
  component: NewChatView,
})
