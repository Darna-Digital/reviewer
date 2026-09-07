import type { ChatModelCatalog, ChatProviderKind } from "@reviewer/core/chats";
import type { ReviewComment } from "@reviewer/core/comments";
import type { VisualComment } from "@reviewer/core/visual-comments";
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

export const buildChatAssignmentSettings = (
  provider: ChatProviderKind,
  catalog: ChatModelCatalog | undefined
): ChatSettings => {
  const defaults = catalog?.defaults;
  const providerEntry = catalog?.providers?.find(
    (entry) => entry.id === provider
  );
  const providerDefaultModel = providerEntry?.models?.find(
    (model) => model.id === defaults?.model
  )?.id;
  // The catalog's models are whatever the provider's CLI reported, so the first
  // is that CLI's own first choice. Nothing reported means no model at all —
  // the chat then runs on whatever the CLI defaults to, which is a better
  // answer than a model id we made up here.
  const firstDiscovered = providerEntry?.models[0]?.id ?? "";

  return {
    provider,
    model: providerDefaultModel ?? firstDiscovered,
    effort: defaults?.effort ?? "high",
    access: defaults?.access ?? "fullAccess",
  };
};

export const buildReviewAssignmentTitle = (count: number): string => {
  const plural = count === 1 ? "" : "s";
  return `Fix ${count} review comment${plural}`;
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

export const buildVisualAssignmentTitle = (count: number): string => {
  const plural = count === 1 ? "" : "s";
  return `Fix ${count} UI comment${plural}`;
};

/**
 * A visual comment points at rendered UI, not at a file, so the agent is given
 * the page and the selector and told where to go looking — plus a nudge that the
 * same browser pane is the thing to check the fix in.
 */
export const buildVisualAssignmentPrompt = (
  comments: ReadonlyArray<VisualComment>
): string => {
  const lines = comments
    .map((comment) =>
      [
        `${comment.url}`,
        `Element: ${comment.selector} (${comment.elementLabel})`,
        `Viewport: ${comment.viewport.width}×${comment.viewport.height}`,
        comment.body,
      ].join("\n")
    )
    .join("\n\n");
  return [
    "Address these comments left on the running UI:",
    "",
    lines,
    "",
    "Find the code that renders each element, then verify your change through",
    "reviewer's browser API (see the reviewer skill) rather than assuming it worked.",
  ].join("\n");
};
