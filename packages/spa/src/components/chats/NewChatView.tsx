/**
 * The /chats index — a fresh thread. Composer settings live in local state
 * seeded from the catalog defaults; the first send creates the chat, starts
 * the turn, and navigates to the conversation (create-on-first-message).
 */
import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { useChatsActions } from "@/features/chats/adapters/chats.hook.adapter"
import type {
  ChatImage,
  ChatSettings,
} from "@/features/chats/entity/chats.interfaces"
import { useChatModels, useRepo } from "@/lib/queries"
import { BranchBadge } from "./BranchBadge"
import { ChatComposer } from "./ChatComposer"

export function NewChatView() {
  const models = useChatModels()
  const repo = useRepo()
  const actions = useChatsActions()
  const navigate = useNavigate()
  const [overrides, setOverrides] = useState<Partial<ChatSettings>>({})

  const defaults = models.data?.defaults
  const settings: ChatSettings = {
    provider: overrides.provider ?? defaults?.provider ?? "claude",
    model: overrides.model ?? defaults?.model ?? "",
    effort: overrides.effort ?? defaults?.effort ?? "high",
    access: overrides.access ?? defaults?.access ?? "fullAccess",
    mode: overrides.mode ?? defaults?.mode ?? "build",
  }

  const send = async (text: string, images: ReadonlyArray<ChatImage>) => {
    try {
      const started = await actions.start(
        settings,
        repo.data?.currentBranch ?? "",
        text,
        images
      )
      if (started !== null) {
        void navigate({
          to: "/chats/$chatId",
          params: { chatId: started.id },
        })
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "failed to start the thread"
      )
      throw error
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b px-4">
        <span className="text-sm font-medium">New thread</span>
        <BranchBadge />
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-sm font-medium">Start a conversation</p>
        <p className="text-sm text-muted-foreground">
          Ask a question, describe a change, or attach an image to begin.
        </p>
      </div>
      <div className="mx-auto w-full max-w-3xl px-6 pb-4">
        <ChatComposer
          settings={settings}
          onSettingsChange={(patch) =>
            setOverrides((prev) => ({ ...prev, ...patch }))
          }
          catalog={models.data}
          onSend={send}
          running={false}
          placeholder="Ask anything, @tag files/folders, or describe a change…"
        />
      </div>
    </div>
  )
}
