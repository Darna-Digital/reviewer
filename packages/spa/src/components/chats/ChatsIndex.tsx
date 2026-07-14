/**
 * The /chats index. Landing here resumes the most recent chat on the current
 * branch by redirecting to it, so reopening Chats picks up where you left off.
 * The new-thread composer is shown only when that branch has no chats yet or
 * when `?new` explicitly asks for a fresh thread (the sidebar's New button).
 */
import { useNavigate, useSearch } from "@tanstack/react-router"
import { useEffect, useMemo } from "react"
import { useChats, useRepo } from "@/lib/queries"
import { NewChatView } from "./NewChatView"

export function ChatsIndex() {
  const navigate = useNavigate()
  const { new: forceNew } = useSearch({ from: "/_workspace/chats/" })
  const chats = useChats()
  const repo = useRepo()

  const currentBranch = repo.data?.currentBranch ?? ""

  // Most recent chat on the current branch (the list is already newest-first).
  const latest = useMemo(() => {
    if (forceNew) return null
    return (chats.data ?? []).find((c) => c.branch === currentBranch) ?? null
  }, [chats.data, currentBranch, forceNew])

  // Only decide once both queries have resolved, so we neither redirect on a
  // stale-empty list nor flash the composer before we know there's a chat.
  const ready = chats.isSuccess && repo.isSuccess

  useEffect(() => {
    if (ready && latest !== null) {
      void navigate({
        to: "/chats/$chatId",
        params: { chatId: latest.id },
        replace: true,
      })
    }
  }, [ready, latest, navigate])

  if (!ready || latest !== null) return null

  return <NewChatView />
}
