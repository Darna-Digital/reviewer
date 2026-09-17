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
  IconAntennaBars1,
  IconAntennaBars2,
  IconAntennaBars3,
  IconAntennaBars4,
  IconAntennaBars5,
  IconAntennaBarsOff,
  IconFlame,
  IconFlameFilled,
  IconLock,
  IconLockOpen,
  IconPencilCheck,
} from "@tabler/icons-react";
import type { ComponentType } from "react";
import {
  EFFORT_ORDER,
  type ChatAccess,
  type ChatEffort,
} from "@reviewer/core/chats";

export type SelectorIcon = ComponentType<{ className?: string }>;

export interface SelectorOption<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly hint: string;
  readonly icon: SelectorIcon;
}

/**
 * The icons climb like signal bars, so the ladder is legible at a glance and
 * the trigger says how deep the thinking is without being read. The top two
 * levels leave the bars behind: five bars is as high as the family goes, and a
 * level past "deeper still" should not look the same as the one below it.
 */
const EFFORT_COPY: Readonly<
  Record<string, { label: string; hint: string; icon: SelectorIcon }>
> = {
  none: {
    label: "None",
    hint: "Answer without reasoning first",
    icon: IconAntennaBarsOff,
  },
  minimal: {
    label: "Minimal",
    hint: "Barely stops to think",
    icon: IconAntennaBars1,
  },
  low: { label: "Low", hint: "Fast, light reasoning", icon: IconAntennaBars2 },
  medium: {
    label: "Medium",
    hint: "Balanced reasoning",
    icon: IconAntennaBars3,
  },
  high: { label: "High", hint: "Deep reasoning", icon: IconAntennaBars4 },
  xhigh: {
    label: "Extra high",
    hint: "Deeper still, and slower",
    icon: IconAntennaBars5,
  },
  max: { label: "Max", hint: "As far as this model goes", icon: IconFlame },
  ultra: {
    label: "Ultra",
    hint: "The longest this model will think",
    icon: IconFlameFilled,
  },
};

/** A level reviewer has no copy for still needs a face; it sits mid-ladder. */
const UNKNOWN_EFFORT_ICON = IconAntennaBars3;

const titleCase = (value: string): string =>
  value.length === 0 ? value : value.slice(0, 1).toUpperCase() + value.slice(1);

const effortRank = (effort: ChatEffort): number => {
  const rank = EFFORT_ORDER.indexOf(effort);
  return rank === -1 ? EFFORT_ORDER.length : rank;
};

/** How an effort level reads in the trigger and the menu. */
export const effortLabel = (effort: ChatEffort): string =>
  EFFORT_COPY[effort]?.label ?? titleCase(effort);

/** The face an effort level wears in the trigger and the menu. */
export const effortIcon = (effort: ChatEffort): SelectorIcon =>
  EFFORT_COPY[effort]?.icon ?? UNKNOWN_EFFORT_ICON;

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
      icon: effortIcon(effort),
    }));

const ACCESS_COPY: Readonly<
  Record<ChatAccess, { label: string; hint: string; icon: SelectorIcon }>
> = {
  supervised: {
    label: "Supervised",
    hint: "Refuse gated commands and edits",
    icon: IconLock,
  },
  acceptEdits: {
    label: "Auto-accept edits",
    hint: "Edit files freely, gate commands",
    icon: IconPencilCheck,
  },
  fullAccess: {
    label: "Full access",
    hint: "Commands and edits without prompts",
    icon: IconLockOpen,
  },
};

/** The access menu for the tiers an agent can tell apart. */
export const accessOptions = (
  tiers: ReadonlyArray<ChatAccess>
): ReadonlyArray<SelectorOption<ChatAccess>> =>
  tiers.map((tier) => ({ value: tier, ...ACCESS_COPY[tier] }));
