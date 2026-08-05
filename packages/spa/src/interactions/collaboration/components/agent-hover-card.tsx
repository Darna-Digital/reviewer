/**
 * Whose agent is this? An agent posts under a person's account, and that person
 * is the thing you cannot read off the row — so hovering any agent mark opens
 * the same elevated card the chats sidebar uses for a thread preview, with the
 * owner as its subject and the run state as supporting detail.
 */
import { IconCloud, IconDeviceLaptop } from "@tabler/icons-react";
import type { ReactElement, ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import {
  AgentMark,
  AgentStateDot,
} from "@/interactions/threads/components/agent-mark";
import {
  agentName,
  agentOwner,
  runtimeLine,
  type MockAgent,
} from "@/interactions/collaboration/data/collaboration.mock";
import { agentHint } from "@/interactions/threads/interfaces/agents";

const HOVER_DELAY_MS = 400;
const HOVER_CLOSE_DELAY_MS = 100;

export function AgentHoverCard({
  agent,
  render,
  side = "right",
  children,
}: {
  agent: MockAgent;
  /** The element the trigger merges into — a span unless the row is a link. */
  render?: ReactElement;
  /** Full-width rows pass "bottom"; beside a small mark, "right" stays anchored. */
  side?: "right" | "bottom";
  children: ReactNode;
}) {
  const owner = agentOwner(agent);

  return (
    <PreviewCard>
      <PreviewCardTrigger
        delay={HOVER_DELAY_MS}
        closeDelay={HOVER_CLOSE_DELAY_MS}
        render={render ?? <span />}
      >
        {children}
      </PreviewCardTrigger>
      <PreviewCardContent side={side} align="start" className="w-72 gap-3 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <AgentMark kind={agent.kind} className="size-7 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.8125rem] font-medium">
              {agentName(agent)}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {agentHint(agent.kind)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {agent.runtime === "cloud" ? (
              <IconCloud className="size-3.5 shrink-0" />
            ) : (
              <IconDeviceLaptop className="size-3.5 shrink-0" />
            )}
            {agent.runtime === "cloud" ? "Shared agent" : "Run by"}
          </p>
          <div className="flex min-w-0 items-center gap-2">
            {agent.runtime === "cloud" ? (
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                <IconCloud className="size-4" />
              </span>
            ) : (
              <Avatar name={owner.name} className="size-7" />
            )}
            <dl className="min-w-0 flex-1">
              <dt className="truncate text-[0.8125rem] font-medium">
                {owner.name}
              </dt>
              <dd className="truncate text-xs text-muted-foreground">
                {owner.detail}
              </dd>
            </dl>
          </div>
          <p className="text-xs text-pretty text-muted-foreground">
            {runtimeLine(agent)}
          </p>
        </div>

        <div className="flex items-start gap-1.5 border-t pt-2">
          <AgentStateDot running={agent.running} className="mt-1.5" />
          <p className="min-w-0 flex-1 text-xs text-pretty text-muted-foreground">
            <span className="font-medium text-foreground">
              {agent.running ? "Running" : "Idle"}
            </span>{" "}
            — {agent.detail}
          </p>
        </div>
      </PreviewCardContent>
    </PreviewCard>
  );
}
