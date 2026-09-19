/**
 * The sessions index — a fresh session, composed from the middle of the pane
 * rather than the bottom edge: nothing has been said yet, so there is no
 * transcript for the composer to sit under, and centring it is what says the
 * page is waiting on you.
 *
 * Composer settings are the ones the last session was composed with, falling
 * back to the favorite model and the catalog defaults while nothing has been
 * chosen yet; the first send creates the chat, starts the turn, and navigates
 * to the conversation (create-on-first-message).
 */
import { useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { toast } from "sonner";
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter";
import type {
  ChatImage,
  ChatSettings,
} from "@/interactions/chats/interfaces/chats.interfaces";
import {
  catalogModels,
  preferredChatModel,
} from "@/interactions/chats/functions/chat-model.functions";
import { catalogCapabilities, withinCapabilities } from "@reviewer/core/chats";
import { NEW_CHAT_DRAFT } from "@/lib/composer-drafts";
import { useChatModels, useRepo } from "@/lib/queries";
import { rememberSession, useUiPrefs } from "@/lib/ui-prefs";
import { ChatComposer } from "./chat-composer";
import { ImageDropZone } from "./image-drop-zone";
import { SessionContextBar } from "./session-context-bar";

export function NewChatView() {
  const models = useChatModels();
  const repo = useRepo();
  const actions = useChatsActions();
  const navigate = useNavigate();
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const prefs = useUiPrefs();
  const last = prefs.lastSession;
  const defaults = models.data?.defaults;
  const preferred = preferredChatModel(models.data, prefs.chatModelFavorites);
  // The remembered model is only offered back while its agent still reports it:
  // a CLI that has dropped a model, or been uninstalled, cannot run it, and the
  // favorites answer instead.
  const remembered = catalogModels(models.data).find(
    (model) => model.id === last.model && model.provider === last.provider
  );
  // The model comes from the catalog and the rest from the last session, which
  // may have been composed with another agent — so what they add up to is put
  // through what this one can actually be run with before it is shown or sent.
  const provider = remembered?.provider ?? preferred?.provider ?? "claude";
  const model = remembered?.id ?? preferred?.id ?? "";
  const settings: ChatSettings = withinCapabilities(
    {
      provider,
      model,
      effort: last.effort ?? defaults?.effort ?? "high",
      access: last.access ?? defaults?.access ?? "fullAccess",
    },
    catalogCapabilities(models.data, provider, model)
  );

  const send = async (text: string, images: ReadonlyArray<ChatImage>) => {
    try {
      const where = { branch: repo.data?.currentBranch ?? "" };
      const started = await actions.start(settings, where, text, images);
      if (started !== null) {
        void navigate({
          to: "/modes/agent-session/$chatId",
          params: { chatId: started.id },
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "failed to start the session"
      );
      throw error;
    }
  };

  return (
    <ImageDropZone
      draftKey={NEW_CHAT_DRAFT}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
        <div className="flex w-full max-w-3xl flex-col gap-5">
          <div className="mb-6 flex flex-col items-center gap-1.5">
            <h1 className="text-center text-2xl font-medium tracking-tight">
              What should we work on?
            </h1>
          </div>
          <div className="flex flex-col">
            {/* Lifted so the composer's own sheet occludes the strip sliding up
              underneath it, which is what makes the two read as one block. */}
            <div className="relative z-10">
              <ChatComposer
                draftKey={NEW_CHAT_DRAFT}
                settings={settings}
                onSettingsChange={rememberSession}
                catalog={models.data}
                onSend={send}
                running={false}
                placeholder="Ask anything, or describe a change…"
                textareaRef={composerRef}
              />
            </div>
            <SessionContextBar />
          </div>
        </div>
      </div>
    </ImageDropZone>
  );
}
