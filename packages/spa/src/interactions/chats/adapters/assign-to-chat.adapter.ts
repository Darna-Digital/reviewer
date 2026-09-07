/**
 * Handing work to an agent session — the step every "assign" button shares.
 *
 * A new target means a titled chat seeded with the prompt; an existing one means
 * the prompt sent as a message into that chat. Both answer with the chat's id,
 * which is what the caller navigates to. What gets resolved afterwards differs
 * per feature (review comments are deleted, visual comments too), so that stays
 * with the caller.
 */
import type { AssignTarget } from "@/components/review-assign-bar";
import type { ChatPlace } from "@/interactions/chats/interfaces/chats.interfaces";
import type { ChatModelCatalog } from "@reviewer/core/chats";
import { buildChatAssignmentSettings } from "../functions/chat-assignment.functions";

interface ChatStarters {
  readonly startWithTitle: (
    settings: ReturnType<typeof buildChatAssignmentSettings>,
    place: ChatPlace,
    title: string,
    text: string
  ) => Promise<{ id: string } | null>;
  readonly send: (id: string, text: string) => Promise<unknown>;
}

export const assignToChat = async (
  actions: ChatStarters,
  input: {
    readonly target: AssignTarget;
    readonly catalog: ChatModelCatalog | undefined;
    /** Where the agent is to work — the branch the comments are about. */
    readonly place: ChatPlace;
    readonly title: string;
    readonly prompt: string;
  }
): Promise<string | null> => {
  if (input.target.kind === "new") {
    const started = await actions.startWithTitle(
      buildChatAssignmentSettings(input.target.agent, input.catalog),
      input.place,
      input.title,
      input.prompt
    );
    return started?.id ?? null;
  }
  const sent = await actions.send(input.target.chatId, input.prompt);
  return sent !== null ? input.target.chatId : null;
};
