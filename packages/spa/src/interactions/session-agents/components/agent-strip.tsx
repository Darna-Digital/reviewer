/**
 * The agents on hand in a session, as a stack of brand marks — the same
 * shorthand a group of people gets, since that is what these are to a session.
 * The strip is where the branch chip used to sit: a session is answered by an
 * agent, not by a checkout.
 */
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AgentMark } from "@/interactions/threads/components/agent-mark";
import { useCustomAgents } from "@/interactions/session-agents/adapters/session-agents.store";
import { AgentManagerDialog } from "@/interactions/session-agents/components/agent-manager-dialog";
import { sessionAgents } from "@/interactions/session-agents/functions/session-agents.functions";
import type { AgentKind } from "@byconvo/core/threads";
import { useChatModels } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function AgentStrip({ className }: { className?: string }) {
  const models = useChatModels();
  const custom = useCustomAgents();
  const [open, setOpen] = useState(false);

  // A provider is only listed once its CLI has answered, so the strip is the
  // set of agents this machine can actually reach.
  const detected = (models.data?.providers ?? []).map(
    (provider) => provider.id as AgentKind
  );
  const agents = sessionAgents(detected, custom);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center">
        {agents.map((agent) => (
          <Tooltip key={agent.id}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label={`${agent.name} — manage agents`}
                  onClick={() => setOpen(true)}
                  className="-ml-1.5 rounded-full outline-none first:ml-0 focus-visible:ring-3 focus-visible:ring-ring/30"
                />
              }
            >
              <AgentMark
                kind={agent.kind}
                className="size-7 rounded-full ring-2 ring-background"
              />
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <span className="flex flex-col">
                {agent.name}
                <span className="font-mono text-muted-foreground">
                  {agent.command}
                </span>
              </span>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Add agent"
              onClick={() => setOpen(true)}
              className="rounded-full border border-dashed border-border text-muted-foreground"
            />
          }
        >
          <IconPlus className="size-4" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Add agent</TooltipContent>
      </Tooltip>

      <AgentManagerDialog agents={agents} open={open} onOpenChange={setOpen} />
    </div>
  );
}
