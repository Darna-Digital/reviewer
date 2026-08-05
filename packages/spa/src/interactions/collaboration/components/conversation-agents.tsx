/**
 * Which agents are in the room, and who may put one there. Every member brings
 * their own: the CLIs on your machine are yours to invite, the workspace's cloud
 * agents are anyone's, and a teammate's local CLI is listed but not yours to
 * take — it is in the picker so the rule is visible rather than a silent
 * absence. The strip sits on the composer because adding an agent is part of
 * writing to the room, not a setting somewhere else.
 */
import {
  IconCloud,
  IconDeviceLaptop,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentHoverCard } from "@/interactions/collaboration/components/agent-hover-card";
import {
  AgentMark,
  AgentStateDot,
} from "@/interactions/threads/components/agent-mark";
import {
  addAgentToConversation,
  agentName,
  agentsIn,
  allAgents,
  removeAgentFromConversation,
  VIEWER,
  type MockAgent,
} from "@/interactions/collaboration/data/collaboration.mock";
import { cn } from "@/lib/utils";

interface AgentGroup {
  title: string;
  hint: string;
  icon: typeof IconCloud;
  agents: ReadonlyArray<MockAgent>;
  /** Cleared for a teammate's machine — theirs to invite, not yours. */
  yours: boolean;
}

const groupsFor = (
  present: ReadonlyArray<MockAgent>
): ReadonlyArray<AgentGroup> => {
  const absent = allAgents().filter(
    (agent) => !present.some((p) => p.id === agent.id)
  );
  return [
    {
      title: "On your machine",
      hint: "Runs locally and posts as you",
      icon: IconDeviceLaptop,
      agents: absent.filter(
        (a) => a.runtime === "local" && a.owner === VIEWER.name
      ),
      yours: true,
    },
    {
      title: "Workspace cloud",
      hint: "Shared — anyone here can call these",
      icon: IconCloud,
      agents: absent.filter((a) => a.runtime === "cloud"),
      yours: true,
    },
    {
      title: "On a teammate's machine",
      hint: "Only its owner can bring it in",
      icon: IconDeviceLaptop,
      agents: absent.filter(
        (a) => a.runtime === "local" && a.owner !== VIEWER.name
      ),
      yours: false,
    },
  ].filter((group) => group.agents.length > 0);
};

function AgentChip({
  agent,
  onRemove,
}: {
  agent: MockAgent;
  onRemove?: () => void;
}) {
  return (
    <span
      className={cn(
        "flex h-7 min-w-0 items-center gap-1.5 rounded-full border bg-background pl-1.5 text-[0.8125rem]",
        onRemove === undefined ? "pr-2.5" : "pr-1"
      )}
    >
      <AgentHoverCard agent={agent} side="bottom">
        <span className="flex min-w-0 items-center gap-1.5">
          <AgentMark kind={agent.kind} className="size-4.5 rounded" />
          <span className="truncate">{agentName(agent)}</span>
          {agent.runtime === "cloud" && (
            <IconCloud
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-label="Runs in the workspace cloud"
            />
          )}
          <AgentStateDot running={agent.running} />
        </span>
      </AgentHoverCard>
      {onRemove !== undefined && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${agentName(agent)} from this conversation`}
          className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground outline-none hover:bg-elevate hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <IconX className="size-3" />
        </button>
      )}
    </span>
  );
}

function AddAgentPopover({
  present,
  onAdd,
}: {
  present: ReadonlyArray<MockAgent>;
  onAdd: (agentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const groups = groupsFor(present);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full py-1.5 pr-2.5 pl-1.5 text-muted-foreground"
          />
        }
      >
        <IconPlus className="size-4 shrink-0" />
        Add an agent
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-80 gap-0 p-0">
        <ScrollArea className="max-h-96" viewportClassName="scroll-fade">
          <div className="p-1.5">
            {groups.map((group) => (
              <div key={group.title} className="flex flex-col">
                <div className="px-2 pt-2.5 pb-1">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <group.icon className="size-3.5 shrink-0 text-muted-foreground" />
                    {group.title}
                  </p>
                  <p className="pl-5 text-xs text-muted-foreground">
                    {group.hint}
                  </p>
                </div>
                {group.agents.map((agent) => (
                  <button
                    key={agent.id}
                    type="button"
                    disabled={!group.yours}
                    onClick={() => {
                      onAdd(agent.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none",
                      group.yours
                        ? "hover:bg-elevate focus-visible:bg-elevate"
                        : "cursor-not-allowed opacity-45"
                    )}
                  >
                    <AgentMark
                      kind={agent.kind}
                      className="size-7 rounded-lg"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.8125rem] font-medium">
                        {agentName(agent)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {group.yours
                          ? agent.detail
                          : `${agent.owner.split(" ")[0]} has to bring this one in`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
            {groups.length === 0 && (
              <p className="px-2 py-3 text-[0.8125rem] text-muted-foreground">
                Every agent you can reach is already here.
              </p>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export function ConversationAgents({
  conversationId,
  canEdit,
}: {
  conversationId: string;
  /** Reading a chat you have not joined shows the line-up but cannot change it. */
  canEdit: boolean;
}) {
  const present = agentsIn(conversationId);

  if (!canEdit && present.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pb-2">
      {present.map((agent) => (
        <AgentChip
          key={agent.id}
          agent={agent}
          onRemove={
            canEdit
              ? () => removeAgentFromConversation(conversationId, agent.id)
              : undefined
          }
        />
      ))}
      {canEdit && (
        <AddAgentPopover
          present={present}
          onAdd={(agentId) => addAgentToConversation(conversationId, agentId)}
        />
      )}
    </div>
  );
}
