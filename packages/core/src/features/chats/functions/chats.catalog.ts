/**
 * The skeleton the composer's model picker is built on: which agents byconvo
 * can drive, and what a new chat starts as.
 *
 * There is deliberately no list of models here. Models come from the agent
 * CLIs themselves (see model-discovery.ts) and nowhere else — a list written
 * down here would start going stale the day it was written, and a stale
 * fallback is worse than none: it offers models that no longer exist and hides
 * ones that do. A provider whose CLI can't be reached simply has no models to
 * offer, and a chat with no model runs on whatever that CLI defaults to.
 */
import type {
  ChatModelCatalog,
  ChatProviderKind,
} from "../schema/chats.schema.ts"

export const CHAT_PROVIDER_KINDS = [
  "claude",
  "codex",
  "opencode",
  "cursor",
] as const satisfies ReadonlyArray<ChatProviderKind>
export const chatProviderLabel: Record<ChatProviderKind, string> = {
  claude: "Claude",
  codex: "Codex",
  opencode: "OpenCode Zen",
  cursor: "Cursor",
}
export const CHAT_MODEL_CATALOG: ChatModelCatalog = {
  providers: CHAT_PROVIDER_KINDS.map((id) => ({
    id,
    label: chatProviderLabel[id],
    models: [],
  })),
  defaults: {
    provider: "claude",
    // Empty on purpose: no model is passed to the CLI until the user picks
    // one, so a new chat runs on the agent's own current default rather than
    // on a model id we guessed here.
    model: "",
    effort: "high",
    access: "fullAccess",
    mode: "build",
  },
}
