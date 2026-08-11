/**
 * The sessions index — a fresh session, composed from the middle of the pane
 * rather than the bottom edge: nothing has been said yet, so there is no
 * transcript for the composer to sit under, and centring it is what says the
 * page is waiting on you.
 *
 * Composer settings live in local state seeded from the favorite model and the
 * catalog defaults; the first send creates the chat, starts the turn, and
 * navigates to the conversation (create-on-first-message).
 */
import { IconSitemap, IconWorld } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter";
import {
  NEW_SESSION,
  setChatMode,
  useChatMode,
} from "@/interactions/chats/adapters/chat-mode.store";
import type {
  ChatImage,
  ChatSettings,
} from "@/interactions/chats/interfaces/chats.interfaces";
import {
  modePrompt,
  modeTitle,
} from "@/interactions/chats/functions/chat-mode.functions";
import { preferredChatModel } from "@/interactions/chats/functions/chat-model.functions";
import { NEW_CHAT_DRAFT, setDraft } from "@/lib/chat-drafts";
import { isDesktop } from "@/lib/desktop";
import { useChatModels, useRepo } from "@/lib/queries";
import { useUiPrefs } from "@/lib/ui-prefs";
import { ChatComposer } from "./chat-composer";
import { SessionContextBar } from "./session-context-bar";

/**
 * Openers for the two things this app can do that a chat box does not advertise
 * — the analysis graph and the browser pane — each carrying the icon its own
 * surface is marked with, so the suggestion and the pane it ends in read as the
 * same feature. Neither one sends: the analysis opener flips the mode the
 * composer is in, and the browser one types the opening of the prompt, leaving
 * the subject to be filled in.
 */
const SUGGESTIONS = [
  {
    icon: IconSitemap,
    label: "Create analysis of a feature",
    kind: "mode",
    desktopOnly: false,
  },
  {
    icon: IconWorld,
    label: "Preview changes in browser",
    kind: "prompt",
    prompt: "Preview my changes in the browser and check ",
    desktopOnly: true,
  },
] as const;

export function NewChatView() {
  const models = useChatModels();
  const repo = useRepo();
  const actions = useChatsActions();
  const navigate = useNavigate();
  const [overrides, setOverrides] = useState<Partial<ChatSettings>>({});
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const mode = useChatMode(NEW_SESSION);

  const favorites = useUiPrefs().chatModelFavorites;
  const defaults = models.data?.defaults;
  const preferred = preferredChatModel(models.data, favorites);
  const settings: ChatSettings = {
    provider: overrides.provider ?? preferred?.provider ?? "claude",
    model: overrides.model ?? preferred?.id ?? "",
    effort: overrides.effort ?? defaults?.effort ?? "high",
    access: overrides.access ?? defaults?.access ?? "fullAccess",
  };

  const send = async (text: string, images: ReadonlyArray<ChatImage>) => {
    const branch = repo.data?.currentBranch ?? "";
    const prompt = modePrompt(mode, text);
    const title = modeTitle(mode, text);
    try {
      const started =
        title === null
          ? await actions.start(settings, branch, prompt, images)
          : await actions.startWithTitle(
              settings,
              branch,
              title,
              prompt,
              images
            );
      if (started !== null) {
        // The session carries the mode it was opened in, so a follow-up in the
        // conversation is still the same kind of work.
        setChatMode(started.id, mode);
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

  const suggestions = SUGGESTIONS.filter((s) => isDesktop || !s.desktopOnly);

  const applySuggestion = (suggestion: (typeof SUGGESTIONS)[number]) => {
    if (suggestion.kind === "mode") {
      setChatMode(NEW_SESSION, "analysis");
      composerRef.current?.focus();
      return;
    }
    // The prompt is an opening, not the whole question, so the caret lands at
    // the end of it ready for the subject.
    setDraft(NEW_CHAT_DRAFT, suggestion.prompt);
    const textarea = composerRef.current;
    if (textarea === null) return;
    textarea.focus();
    textarea.setSelectionRange(
      suggestion.prompt.length,
      suggestion.prompt.length
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8">
      <div className="flex w-full max-w-3xl flex-col gap-5">
        <div className="mb-6 flex flex-col items-center gap-1.5">
          <h1 className="text-center text-2xl font-medium tracking-tight">
            {mode === "analysis"
              ? "What should we analyse?"
              : "What should we work on?"}
          </h1>
          {mode === "analysis" && (
            <p className="max-w-md text-center text-sm text-pretty text-muted-foreground">
              An agent reads the code and draws the flow, front to back, into
              the analysis pane.
            </p>
          )}
        </div>
        <div className="flex flex-col">
          {/* Lifted so the composer's own sheet occludes the strip sliding up
              underneath it, which is what makes the two read as one block. */}
          <div className="relative z-10">
            <ChatComposer
              draftKey={NEW_CHAT_DRAFT}
              settings={settings}
              onSettingsChange={(patch) =>
                setOverrides((prev) => ({ ...prev, ...patch }))
              }
              mode={mode}
              onModeChange={(next) => setChatMode(NEW_SESSION, next)}
              catalog={models.data}
              onSend={send}
              running={false}
              placeholder={
                mode === "analysis"
                  ? "How is a new branch created?"
                  : "Ask anything, or describe a change…"
              }
              textareaRef={composerRef}
            />
          </div>
          <SessionContextBar />
        </div>
        <div className="flex flex-col gap-px empty:hidden">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              type="button"
              onClick={() => applySuggestion(suggestion)}
              className="flex h-9 items-center gap-2.5 rounded-lg px-2 text-left text-sm text-muted-foreground outline-none hover:bg-elevate hover:text-foreground focus-visible:bg-elevate focus-visible:text-foreground"
            >
              <suggestion.icon className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{suggestion.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
