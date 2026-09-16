import type { ChatModelCatalog, ChatProviderKind } from "@reviewer/core/chats";
import type { ReviewComment } from "@reviewer/core/comments";
import type { VisualComment } from "@reviewer/core/visual-comments";
import { formatStyleChanges } from "@/interactions/visual-comments/functions/visual-style.functions";
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
    .map((comment) => {
      // Tried on the element live, so these are the values that looked right,
      // not a guess at them — the agent should land exactly these.
      const changes = formatStyleChanges(comment.styleChanges ?? []);
      return [
        `${comment.url}`,
        `Element: ${comment.selector} (${comment.elementLabel})`,
        `Viewport: ${comment.viewport.width}×${comment.viewport.height}`,
        ...(changes.length > 0
          ? ["Style changes:", ...changes.map((change) => `  ${change}`)]
          : []),
        ...(comment.body.length > 0 ? [comment.body] : []),
      ].join("\n");
    })
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

/**
 * A review handed over in one go.
 *
 * Notes left on the code and notes left on the running UI are one review — you
 * read the app and you read what renders it — so they go to the agent together
 * rather than as two hand-offs racing each other over the same files. Either
 * kind on its own is still described in its own words.
 */
export const buildHandoffTitle = (review: number, visual: number): string => {
  if (visual === 0) return buildReviewAssignmentTitle(review);
  if (review === 0) return buildVisualAssignmentTitle(visual);
  const total = review + visual;
  return `Fix ${total} review comment${total === 1 ? "" : "s"}`;
};

export const buildHandoffPrompt = (
  review: ReadonlyArray<ReviewComment>,
  visual: ReadonlyArray<VisualComment>
): string => {
  if (visual.length === 0) return buildReviewAssignmentPrompt(review);
  if (review.length === 0) return buildVisualAssignmentPrompt(visual);
  return [
    buildReviewAssignmentPrompt(review),
    "",
    buildVisualAssignmentPrompt(visual),
  ].join("\n");
};
