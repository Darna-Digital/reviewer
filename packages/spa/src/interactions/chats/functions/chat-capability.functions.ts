/**
 * The composer's selector rows, built from what the chosen agent can actually
 * be asked for (`chatCapabilities`) rather than from a fixed list.
 *
 * The levels come from the agent CLIs, so the copy here is a courtesy, not a
 * gate: a level reviewer has never seen still reaches the menu, under its own
 * name. Ordering is ours — the CLIs list them in whatever order they please,
 * and a menu that runs shallow to deep reads the same for every agent.
 */
import {
  EFFORT_ORDER,
  type ChatAccess,
  type ChatEffort,
} from "@reviewer/core/chats";

export interface SelectorOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly hint: string;
}

const EFFORT_COPY: Readonly<Record<string, { label: string; hint: string }>> = {
  none: { label: "None", hint: "Answer without reasoning first" },
  minimal: { label: "Minimal", hint: "Barely stops to think" },
  low: { label: "Low", hint: "Fast, light reasoning" },
  medium: { label: "Medium", hint: "Balanced reasoning" },
  high: { label: "High", hint: "Deep reasoning" },
  xhigh: { label: "Extra high", hint: "Deeper still, and slower" },
  max: { label: "Max", hint: "As far as this model goes" },
  ultra: { label: "Ultra", hint: "The longest this model will think" },
};

const titleCase = (value: string): string =>
  value.length === 0 ? value : value.slice(0, 1).toUpperCase() + value.slice(1);

const effortRank = (effort: ChatEffort): number => {
  const rank = EFFORT_ORDER.indexOf(effort);
  return rank === -1 ? EFFORT_ORDER.length : rank;
};

/** How an effort level reads in the trigger and the menu. */
export const effortLabel = (effort: ChatEffort): string =>
  EFFORT_COPY[effort]?.label ?? titleCase(effort);

/** The effort menu for a set of levels, shallowest first. */
export const effortOptions = (
  efforts: ReadonlyArray<ChatEffort>
): ReadonlyArray<SelectorOption<ChatEffort>> =>
  [...efforts]
    .sort((a, b) => effortRank(a) - effortRank(b))
    .map((effort) => ({
      value: effort,
      label: effortLabel(effort),
      hint: EFFORT_COPY[effort]?.hint ?? "",
    }));

const ACCESS_COPY: Readonly<
  Record<ChatAccess, { label: string; hint: string }>
> = {
  supervised: {
    label: "Supervised",
    hint: "Refuse gated commands and edits",
  },
  acceptEdits: {
    label: "Auto-accept edits",
    hint: "Edit files freely, gate commands",
  },
  fullAccess: {
    label: "Full access",
    hint: "Commands and edits without prompts",
  },
};

/** The access menu for the tiers an agent can tell apart. */
export const accessOptions = (
  tiers: ReadonlyArray<ChatAccess>
): ReadonlyArray<SelectorOption<ChatAccess>> =>
  tiers.map((tier) => ({ value: tier, ...ACCESS_COPY[tier] }));
