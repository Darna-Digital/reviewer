import { createFileRoute } from "@tanstack/react-router"
import { ChatsIndex } from "@/components/chats/ChatsIndex"

/** Whether to force the new-thread composer instead of resuming a chat. */
export interface ChatsIndexSearch {
  new?: boolean
}

export const Route = createFileRoute("/_workspace/chats/")({
  validateSearch: (search: Record<string, unknown>): ChatsIndexSearch => ({
    new: search["new"] === true || search["new"] === "true" ? true : undefined,
  }),
  component: ChatsIndex,
})
