/**
 * The workspace's chats, re-read whenever one is joined, approved, or has an
 * agent brought in. Agents are part of what a chat shows, so this listens to
 * both stores and watches the shared revision — a chat's agent line-up is a
 * record rather than an array, and there is no reference to compare.
 */
import { useSyncExternalStore } from "react"
import {
  allChats,
  collaborationRevision,
  subscribeToAgents,
  subscribeToChats,
  type MockChat,
} from "@/interactions/collaboration/data/collaboration.mock"

const subscribeToBoth = (listener: () => void) => {
  const stopChats = subscribeToChats(listener)
  const stopAgents = subscribeToAgents(listener)
  return () => {
    stopChats()
    stopAgents()
  }
}

/** Re-renders the caller on any collaboration change; returns nothing itself. */
export function useCollaborationChanges(): void {
  useSyncExternalStore(
    subscribeToBoth,
    collaborationRevision,
    collaborationRevision
  )
}

export function useChats(): ReadonlyArray<MockChat> {
  useCollaborationChanges()
  return allChats()
}

export function useChat(id: string): MockChat | undefined {
  useCollaborationChanges()
  return allChats().find((c) => c.id === id)
}
