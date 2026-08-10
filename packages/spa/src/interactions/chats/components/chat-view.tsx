/**
 * One conversation — the live chat view for /chats/$chatId. State comes from
 * the chat WebSocket (snapshot + streamed events through the pure reducer);
 * sends/stops/settings go through the REST actions and come back as events.
 */
import { IconPlugConnectedX } from "@tabler/icons-react";
import { toast } from "sonner";
import { LoadingCursor } from "@/components/ui/loading-cursor";
import { useChatStream } from "@/interactions/chats/adapters/chats.stream.adapter";
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter";
import type {
  ChatImage,
  ChatSettings,
} from "@/interactions/chats/interfaces/chats.interfaces";
import { isChatRunning } from "@/interactions/chats/functions/chats.reducer";
import { useChatModels } from "@/lib/queries";
import { ChatComposer } from "./chat-composer";
import { MessagesTimeline } from "./messages-timeline";
import { SessionContextBar } from "./session-context-bar";

export function ChatView({ chatId }: { chatId: string }) {
  const { chat, error, status } = useChatStream(chatId);
  const models = useChatModels();
  const actions = useChatsActions();

  if (error !== null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
        <div className="font-medium">Thread unavailable</div>
        <div className="text-muted-foreground">{error}</div>
      </div>
    );
  }
  if (chat === null) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingCursor label="Loading thread…" />
      </div>
    );
  }

  const running = isChatRunning(chat);
  const settings: ChatSettings = {
    provider: chat.provider,
    model: chat.model,
    effort: chat.effort,
    access: chat.access,
  };

  const send = async (text: string, images: ReadonlyArray<ChatImage>) => {
    try {
      await actions.send(chat.id, text, images);
    } catch (sendError) {
      toast.error(
        sendError instanceof Error ? sendError.message : "failed to send"
      );
      throw sendError;
    }
  };

  const changeSettings = (patch: Partial<ChatSettings>) => {
    actions.updateSettings(chat.id, patch).catch((updateError: unknown) => {
      toast.error(
        updateError instanceof Error
          ? updateError.message
          : "failed to update settings"
      );
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Streamed text keeps rendering from the last snapshot while this shows,
          so say the connection dropped rather than let a stalled reply read as
          an agent that simply stopped talking. The turn itself keeps running on
          the server; reconnecting replays a fresh snapshot. */}
      {status === "reconnecting" && (
        <div className="flex items-center justify-center gap-1.5 border-b border-warning/30 bg-warning/10 py-1 text-xs text-warning-foreground">
          <IconPlugConnectedX className="size-3.5" />
          Connection lost — reconnecting…
        </div>
      )}
      {chat.messages.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          Send a message to start the conversation.
        </div>
      ) : (
        <MessagesTimeline chat={chat} />
      )}
      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col px-2 pb-4">
        {/* Lifted so the composer's own sheet occludes the strip sliding up
            underneath it, which is what makes the two read as one block. */}
        <div className="relative z-10">
          <ChatComposer
            draftKey={chat.id}
            settings={settings}
            onSettingsChange={changeSettings}
            catalog={models.data}
            onSend={send}
            running={running}
            onStop={() => {
              void actions.stop(chat.id);
            }}
            placeholder="Ask for follow-up changes or attach images…"
          />
        </div>
        <SessionContextBar projectLocked />
      </div>
    </div>
  );
}
