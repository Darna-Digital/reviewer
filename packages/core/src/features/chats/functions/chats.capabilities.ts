/**
 * What the composer may actually offer for a chat — the effort levels and the
 * access tiers the chosen agent can be driven at, for the chosen model.
 *
 * The three selectors under the prompt box are not one fixed row: they are a
 * question asked of the agent CLI that is about to be spawned. cursor-agent has
 * no reasoning flag at all, so an effort menu beside it is a lie; opencode
 * names its levels per model (`variants`, which for one model are low/high and
 * for another minimal…max) and only knows one permission switch; codex reports
 * a different slice of levels for every model it lists. Offering the same three
 * options everywhere means either sending a flag the CLI rejects or showing a
 * choice that changes nothing.
 *
 * So the levels come from the CLIs themselves, through discovery
 * (`model-discovery.ts` fills `ChatModel.efforts`), and this decides what to do
 * with them. An agent that reported nothing offers no effort menu at all rather
 * than a guessed one — the same call `chats.catalog.ts` makes about models.
 *
 * Access is the other way round: the three tiers are ours, not the CLIs', and
 * `layers/chats/providers.ts` maps each of them onto whatever flag that agent
 * has. Two agents can only tell two of them apart, so the tiers a provider can
 * express are what it offers, and a chat sitting on a tier that agent cannot
 * express resolves to the one it would really have run at.
 */
import type {
  ChatAccess,
  ChatEffort,
  ChatModel,
  ChatModelCatalog,
  ChatProviderKind,
} from "../schema/chats.schema.ts";

/**
 * Effort levels in ascending order, used to snap a chat onto the nearest level
 * its new model does offer. Every vocabulary reviewer has seen is in here
 * (claude's `--effort`, codex's reasoning levels, opencode's variants); a level
 * from a CLI that isn't ranks after the last of them, so it is still offered —
 * just never chosen as somebody else's nearest.
 */
export const EFFORT_ORDER: ReadonlyArray<ChatEffort> = [
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
];

const effortRank = (effort: ChatEffort): number => {
  const rank = EFFORT_ORDER.indexOf(effort);
  return rank === -1 ? EFFORT_ORDER.length : rank;
};

/**
 * The levels claude is driven at. Claude's own `--effort` flag takes more of
 * them, but reviewer spends the reasoning budget through MAX_THINKING_TOKENS
 * (see `providers.ts`) — these are the levels that mapping covers, and a level
 * we cannot turn into a budget is not one to offer.
 */
const CLAUDE_EFFORTS: ReadonlyArray<ChatEffort> = ["low", "medium", "high"];

/**
 * The levels codex accepts when its catalog could not be read. Codex reports
 * them per model (`supported_reasoning_levels`) and always takes
 * `model_reasoning_effort`, so an unreachable CLI keeps the menu rather than
 * losing a setting that does work.
 */
const CODEX_EFFORTS: ReadonlyArray<ChatEffort> = ["low", "medium", "high"];

/**
 * Where each tier lands for an agent that cannot tell all three apart, which is
 * also what its chats have been running as:
 *
 *   cursor    one switch (`--force`). Print mode cannot stop to ask, so
 *             "auto-accept edits" has always been full access in practice.
 *   opencode  one switch (`--auto`). Anything short of it leaves permissions to
 *             the developer's own opencode config, which is what "supervised"
 *             means for this agent.
 */
const ACCESS_TIERS: Record<
  ChatProviderKind,
  Readonly<Record<ChatAccess, ChatAccess>>
> = {
  claude: {
    supervised: "supervised",
    acceptEdits: "acceptEdits",
    fullAccess: "fullAccess",
  },
  codex: {
    supervised: "supervised",
    acceptEdits: "acceptEdits",
    fullAccess: "fullAccess",
  },
  cursor: {
    supervised: "supervised",
    acceptEdits: "fullAccess",
    fullAccess: "fullAccess",
  },
  opencode: {
    supervised: "supervised",
    acceptEdits: "supervised",
    fullAccess: "fullAccess",
  },
};

const ACCESS_ORDER: ReadonlyArray<ChatAccess> = [
  "supervised",
  "acceptEdits",
  "fullAccess",
];

export interface ChatCapabilities {
  /** Empty means the agent decides — no flag is sent and no menu is shown. */
  readonly efforts: ReadonlyArray<ChatEffort>;
  readonly access: ReadonlyArray<ChatAccess>;
}

/** The tier `access` really runs at on `provider`. */
export const resolveChatAccess = (
  provider: ChatProviderKind,
  access: ChatAccess
): ChatAccess => ACCESS_TIERS[provider][access];

/** The tiers `provider` can tell apart, in order. */
export const chatAccessTiers = (
  provider: ChatProviderKind
): ReadonlyArray<ChatAccess> =>
  ACCESS_ORDER.filter((tier) => resolveChatAccess(provider, tier) === tier);

const discoveredEfforts = (
  model: ChatModel | undefined
): ReadonlyArray<ChatEffort> | undefined => {
  const efforts = model?.efforts;
  return efforts !== undefined && efforts.length > 0 ? efforts : undefined;
};

/**
 * What `provider` can be asked for while running `model` — the model as the
 * catalog holds it, so a model the CLI never reported (or a chat left on the
 * agent's own default) falls back to what the provider itself supports.
 */
export const chatCapabilities = (
  provider: ChatProviderKind,
  model: ChatModel | undefined
): ChatCapabilities => ({
  efforts: (() => {
    switch (provider) {
      case "claude":
        return CLAUDE_EFFORTS;
      case "codex":
        return discoveredEfforts(model) ?? CODEX_EFFORTS;
      case "opencode":
        // No fallback: `--variant` is the model's own vocabulary, and there is
        // nothing to guess with when opencode hasn't named it.
        return discoveredEfforts(model) ?? [];
      case "cursor":
        // cursor-agent has no effort flag — reasoning depth is part of the
        // model you pick (`…-thinking-high`), so the menu would do nothing.
        return [];
    }
  })(),
  access: chatAccessTiers(provider),
});

/** The model as the catalog holds it, for a provider/model pair. */
export const catalogModel = (
  catalog: ChatModelCatalog | undefined,
  provider: ChatProviderKind,
  model: string
): ChatModel | undefined =>
  catalog?.providers
    .find((entry) => entry.id === provider)
    ?.models.find((entry) => entry.id === model);

/** What `provider` running `model` offers, read straight off a catalog. */
export const catalogCapabilities = (
  catalog: ChatModelCatalog | undefined,
  provider: ChatProviderKind,
  model: string
): ChatCapabilities =>
  chatCapabilities(provider, catalogModel(catalog, provider, model));

/**
 * The level to run at when `effort` is not one the offered set holds: the
 * closest one it does, so moving a chat from a model that thinks hard to one
 * that barely thinks keeps the intent rather than resetting it. Ties go to the
 * deeper level — the reader asked for more thinking, not less. Undefined when
 * nothing is on offer, which is the agent deciding for itself.
 */
export const nearestEffort = <T extends ChatEffort>(
  efforts: ReadonlyArray<T>,
  effort: ChatEffort
): T | undefined => {
  const exact = efforts.find((candidate) => candidate === effort);
  if (exact !== undefined) return exact;
  const wanted = effortRank(effort);
  return efforts.reduce<T | undefined>((best, candidate) => {
    if (best === undefined) return candidate;
    const gap = Math.abs(effortRank(candidate) - wanted);
    const bestGap = Math.abs(effortRank(best) - wanted);
    if (gap !== bestGap) return gap < bestGap ? candidate : best;
    return effortRank(candidate) > effortRank(best) ? candidate : best;
  }, undefined);
};

export interface ChatSettingsShape {
  readonly provider: ChatProviderKind;
  readonly model: string;
  readonly effort: ChatEffort;
  readonly access: ChatAccess;
}

/**
 * Settings the chosen agent can actually be run with: an effort it offers (or
 * none at all), and the access tier it can tell apart. Applied wherever
 * settings are chosen or stored, so no part of the app has to trust that the
 * last agent's settings mean anything to this one.
 */
export const withinCapabilities = <T extends ChatSettingsShape>(
  settings: T,
  capabilities: ChatCapabilities
): T => {
  const effort = nearestEffort(capabilities.efforts, settings.effort) ?? "";
  const access = resolveChatAccess(settings.provider, settings.access);
  return effort === settings.effort && access === settings.access
    ? settings
    : { ...settings, effort, access };
};
