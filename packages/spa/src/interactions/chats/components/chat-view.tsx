/**
 * One conversation — the live chat view for /chats/$chatId. State comes from
 * the chat WebSocket (snapshot + streamed events through the pure reducer);
 * sends/stops/settings go through the REST actions and come back as events.
 */
import { toast } from "sonner"
import { useChatStream } from "@/interactions/chats/adapters/chats.stream.adapter"
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter"
import type {
  ChatImage,
  ChatSettings,
} from "@/interactions/chats/interfaces/chats.interfaces"
import { isChatRunning } from "@/interactions/chats/functions/chats.reducer"
import { useChatModels } from "@/lib/queries"
import { ChatComposer } from "./chat-composer"
import { MessagesTimeline } from "./messages-timeline"

export function ChatView({ chatId }: { chatId: string }) {
  const { chat, error } = useChatStream(chatId)
  const models = useChatModels()
  const actions = useChatsActions()

  if (error !== null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
        <div className="font-medium">Thread unavailable</div>
        <div className="text-muted-foreground">{error}</div>
      </div>
    )
  }
  if (chat === null) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading thread…
      </div>
    )
  }

  const running = isChatRunning(chat)
  const settings: ChatSettings = {
    provider: chat.provider,
    model: chat.model,
    effort: chat.effort,
    access: chat.access,
    mode: chat.mode,
  }

  const send = async (text: string, images: ReadonlyArray<ChatImage>) => {
    try {
      await actions.send(chat.id, text, images)
    } catch (sendError) {
      toast.error(
        sendError instanceof Error ? sendError.message : "failed to send"
      )
      throw sendError
    }
  }

  const changeSettings = (patch: Partial<ChatSettings>) => {
    actions.updateSettings(chat.id, patch).catch((updateError: unknown) => {
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : "failed to update settings"
      )
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {chat.messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Send a message to start the conversation.
        </div>
      ) : (
        <MessagesTimeline chat={chat} />
      )}
      <div className="mx-auto w-full max-w-3xl px-2 pb-4">
        <ChatComposer
          draftKey={chat.id}
          settings={settings}
          onSettingsChange={changeSettings}
          catalog={models.data}
          onSend={send}
          running={running}
          onStop={() => {
            void actions.stop(chat.id)
          }}
          placeholder="Ask for follow-up changes or attach images…"
        />
      </div>
    </div>
  )
}
