/**
 * Per-provider glyphs for the model picker and composer trigger. These are the
 * same brand marks the terminal threads use in their agent menu/sidebar (a chat
 * provider *is* one of those agent CLIs), so both surfaces read identically —
 * `agentIcon` is the single source. Monochrome via `currentColor`, so context
 * decides muted vs. foreground.
 */
import { agentIcon } from "@/interactions/threads/components/agent-icons";
import type { ChatProviderKind } from "@byconvo/core/chats";

export function ProviderIcon({
  provider,
  className,
}: {
  provider: ChatProviderKind;
  className?: string;
}) {
  // ChatProviderKind (claude | codex | opencode) is a subset of AgentKind.
  const Icon = agentIcon(provider);
  return <Icon className={className} />;
}
