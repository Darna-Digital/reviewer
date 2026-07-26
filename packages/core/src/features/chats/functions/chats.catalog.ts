/**
 * The model catalog the composer's picker is built from.
 *
 * This is the *fallback*, not the source of truth: at runtime each provider's
 * models are read from its own CLI (see model-discovery.ts) and these entries
 * are replaced. They stand in only when a CLI isn't installed, is too slow, or
 * answers in a shape we don't recognise — so they should stay roughly right,
 * but they no longer have to be chased every time a model ships.
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
  providers: [
    {
      id: "claude",
      label: "Claude",
      models: [
        { id: "claude-fable-5", label: "Claude Fable 5" },
        { id: "claude-opus-5", label: "Claude Opus 5" },
        { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
        { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
        { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      ],
    },
    {
      id: "codex",
      label: "Codex",
      models: [
        { id: "gpt-5.6-sol", label: "GPT-5.6-Sol" },
        { id: "gpt-5.6-terra", label: "GPT-5.6-Terra" },
        { id: "gpt-5.6-luna", label: "GPT-5.6-Luna" },
        { id: "gpt-5.5", label: "GPT-5.5" },
      ],
    },
    {
      id: "opencode",
      label: "OpenCode Zen",
      models: [
        { id: "opencode/big-pickle", label: "Big Pickle" },
        { id: "opencode/claude-fable-5", label: "Claude Fable 5" },
        { id: "opencode/claude-haiku-4-5", label: "Claude Haiku 4.5" },
        { id: "opencode/claude-opus-4-6", label: "Claude Opus 4.6" },
        { id: "opencode/claude-opus-4-5", label: "Claude Opus 4.5" },
      ],
    },
    {
      id: "cursor",
      label: "Cursor",
      // Cursor's own Composer line leads: they are the low-latency models the
      // CLI is fastest with. The frontier models it also proxies are listed
      // after. An id the catalog doesn't know still works — it is passed
      // through to `--model` verbatim.
      models: [
        { id: "composer-2.5", label: "Composer 2.5" },
        { id: "composer-2", label: "Composer 2" },
        { id: "composer-1.5", label: "Composer 1.5" },
        { id: "sonnet-4.7", label: "Claude Sonnet 4.7" },
        { id: "gpt-5.5", label: "GPT-5.5" },
      ],
    },
  ],
  defaults: {
    provider: "claude",
    model: "claude-opus-5",
    effort: "high",
    access: "fullAccess",
    mode: "build",
  },
}
