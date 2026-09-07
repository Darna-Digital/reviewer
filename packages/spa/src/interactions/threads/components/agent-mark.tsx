/**
 * An agent's brand mark — the same glyph the chats sidebar and the terminal
 * threads use for that CLI, so an agent reads as the tool it is instead of
 * wearing an initials avatar like a teammate. `data-agent` carries the vendor's
 * brand colour in `--agent` (see styles.css); the chip is that colour at low
 * alpha so the mark stays a quiet chip rather than a swatch. The icon scales
 * with whatever box size the caller passes.
 */
import { agentIcon } from "@/interactions/threads/components/agent-icons";
import type { AgentKind } from "@reviewer/core/threads";
import { cn } from "@/lib/utils";

export function AgentMark({
  kind,
  className,
}: {
  kind: AgentKind;
  className?: string;
}) {
  const Icon = agentIcon(kind);
  return (
    <span
      aria-hidden
      data-agent={kind}
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-md bg-(--agent)/12 text-(--agent)",
        className
      )}
    >
      <Icon className="size-[62%]" />
    </span>
  );
}

/**
 * The bare brand glyph in the vendor's colour, for rows too tight for the chip.
 * `contents` keeps the wrapper out of layout — it only carries the colour down.
 */
export function AgentGlyph({
  kind,
  className,
}: {
  kind: AgentKind;
  className?: string;
}) {
  const Icon = agentIcon(kind);
  return (
    <span data-agent={kind} className="contents text-(--agent)">
      <Icon className={className} />
    </span>
  );
}

/** Mid-turn agents pulse, exactly as a running chat row does in the sidebar. */
export function AgentStateDot({
  running,
  className,
}: {
  running: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        running ? "animate-pulse bg-brand-500" : "bg-muted-foreground/40",
        className
      )}
    />
  );
}
