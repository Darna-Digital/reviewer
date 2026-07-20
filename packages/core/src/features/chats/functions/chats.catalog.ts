import type {
  ChatModelCatalog,
  ChatProviderKind,
} from "../schema/chats.schema.ts"

export const CHAT_PROVIDER_KINDS = [
  "claude",
  "codex",
  "opencode",
] as const satisfies ReadonlyArray<ChatProviderKind>
export const chatProviderLabel: Record<ChatProviderKind, string> = {
  claude: "Claude",
  codex: "Codex",
  opencode: "OpenCode Zen",
}
export const CHAT_MODEL_CATALOG: ChatModelCatalog = {
  providers: [
    {
      id: "claude",
      label: "Claude",
      models: [
        { id: "claude-fable-5", label: "Claude Fable 5" },
        { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
        { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
        { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
      ],
    },
    {
      id: "codex",
      label: "Codex",
      models: [
        { id: "gpt-5.5", label: "GPT-5.5" },
        { id: "gpt-5.4", label: "GPT-5.4" },
        { id: "gpt-5.4-mini", label: "GPT-5.4-Mini" },
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
  ],
  defaults: {
    provider: "claude",
    model: "claude-opus-4-8",
    effort: "high",
    access: "fullAccess",
    mode: "build",
  },
}
