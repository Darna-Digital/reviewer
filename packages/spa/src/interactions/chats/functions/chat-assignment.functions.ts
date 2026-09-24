import {
  type ChatModelCatalog,
  type ChatProviderKind,
  titleFromPrompt,
} from "@reviewer/core/chats";
import type { ReviewComment } from "@reviewer/core/comments";
import type { ChatSettings } from "../interfaces/chats.interfaces";

export const ASSIGNABLE_CHAT_PROVIDERS = [
  "claude",
  "opencode",
  "codex",
  "cursor",
] as const satisfies ReadonlyArray<ChatProviderKind>;

export const isChatProviderKind = (value: string): value is ChatProviderKind =>
  (ASSIGNABLE_CHAT_PROVIDERS as ReadonlyArray<string>).includes(value);

export const trailingAgentMention = (value: string): string | null => {
  const match = /(?:^|\s)@(\w*)$/.exec(value);
  if (match === null) return null;
  return match[1];
};

const mentionPattern = (provider: ChatProviderKind): RegExp =>
  new RegExp(`(?:^|\\s)@${provider}\\b`, "i");

export const mentionedChatProvider = (
  body: string
): ChatProviderKind | null => {
  for (const provider of ASSIGNABLE_CHAT_PROVIDERS) {
    if (mentionPattern(provider).test(body)) return provider;
  }
  return null;
};

export const instructionWithoutChatProviderMention = (
  body: string,
  provider: ChatProviderKind
): string => body.replace(mentionPattern(provider), "").trim();

/**
 * Which model a new chat with `provider` runs.
 *
 * `wanted` is the model somebody asked for, and it is honoured only when this
 * provider reported it: a model remembered from the last session belongs to
 * whichever agent was chosen then, and handing it to another one asks a CLI for
 * a model it cannot run.
 *
 * The catalog's models are whatever the provider's CLI reported, so the first
 * is that CLI's own first choice. Nothing reported means no model at all — the
 * chat then runs on whatever the CLI defaults to, which is a better answer than
 * a model id we made up here.
 */
export const assignmentModel = (
  provider: ChatProviderKind,
  catalog: ChatModelCatalog | undefined,
  wanted?: string
): string => {
  const models =
    catalog?.providers.find((entry) => entry.id === provider)?.models ?? [];
  const asked = models.find((model) => model.id === wanted)?.id;
  const providerDefault = models.find(
    (model) => model.id === catalog?.defaults.model
  )?.id;
  return asked ?? providerDefault ?? models[0]?.id ?? "";
};

export const buildChatAssignmentSettings = (
  provider: ChatProviderKind,
  catalog: ChatModelCatalog | undefined,
  model?: string
): ChatSettings => ({
  provider,
  model: assignmentModel(provider, catalog, model),
  effort: catalog?.defaults.effort ?? "high",
  access: catalog?.defaults.access ?? "fullAccess",
});

/**
 * The chat is named after what was actually asked, so the sidebar reads
 * "Rename this to sessionId" rather than "Fix 1 review comment". With several
 * comments the first one leads and the rest are counted.
 */
export const buildReviewAssignmentTitle = (
  comments: ReadonlyArray<ReviewComment>
): string => {
  const [first, ...rest] = comments;
  const lead = titleFromPrompt(first?.body ?? "");
  if (lead.length === 0) {
    const plural = comments.length === 1 ? "" : "s";
    return `Fix ${comments.length} review comment${plural}`;
  }
  return rest.length === 0 ? lead : `${lead} (+${rest.length} more)`;
};

export const buildReviewAssignmentPrompt = (
  comments: ReadonlyArray<ReviewComment>
): string => {
  const lines = comments
    .map(
      (comment) => `${comment.filePath}:${comment.lineNumber} - ${comment.body}`
    )
    .join("\n");
  return `Address these review comments in the codebase:\n\n${lines}`;
};
