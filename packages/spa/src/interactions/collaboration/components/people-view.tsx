import { IconDots } from "@tabler/icons-react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AddAgentButton } from "@/interactions/collaboration/components/agent-add-dialog"
import { AgentHoverCard } from "@/interactions/collaboration/components/agent-hover-card"
import {
  AgentMark,
  AgentStateDot,
} from "@/interactions/collaboration/components/agent-mark"
import {
  PaneBody,
  PaneHeader,
} from "@/interactions/collaboration/components/pane-header"
import {
  ACCESS_LABEL,
  agentName,
  MEMBERS,
  removeAgent,
  setAgentRunning,
  type MockAgent,
} from "@/interactions/collaboration/data/collaboration.mock"
import { useAgents } from "@/interactions/collaboration/data/use-agents"
import { cn } from "@/lib/utils"

const ROW = "flex items-center gap-3"

function AgentControls({ agent }: { agent: MockAgent }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            aria-label={`Options for ${agentName(agent)}`}
          />
        }
      >
        <IconDots className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem
          onClick={() => setAgentRunning(agent.id, !agent.running)}
        >
          {agent.running ? "Pause" : "Resume"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => removeAgent(agent.id)}>
          Remove from workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function AgentRows({ selectedId }: { selectedId?: string }) {
  const agents = useAgents()
  const running = agents.filter((a) => a.running).length

  return (
    <>
      <PaneHeader
        crumbs={[
          <span key="title" className="font-medium">
            Agents
          </span>,
        ]}
        actions={
          <>
            <span className="text-xs text-muted-foreground tabular-nums">
              {running} of {agents.length} running
            </span>
            <AddAgentButton />
          </>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <PaneBody>
          <h1 className="text-lg font-semibold">Agents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The agent CLIs this workspace runs, each under its owner&rsquo;s
            account.
          </p>

          <ul role="list" className="mt-5 divide-y">
            {agents.map((agent) => (
              <li
                key={agent.id}
                aria-current={agent.id === selectedId ? "true" : undefined}
                className={cn(
                  "flex items-center gap-1 py-3",
                  agent.id === selectedId &&
                    "-mx-2 rounded-lg bg-muted px-2 [&+li]:border-transparent"
                )}
              >
                <AgentHoverCard
                  agent={agent}
                  side="bottom"
                  render={<div className={cn(ROW, "min-w-0 flex-1")} />}
                >
                  <AgentMark kind={agent.kind} className="size-7" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium">
                      {agentName(agent)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {agent.detail}
                    </p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                    {ACCESS_LABEL[agent.access]}
                    <span className="text-muted-foreground/40">·</span>
                    <AgentStateDot running={agent.running} />
                    {agent.running ? "Running" : "Idle"}
                  </span>
                </AgentHoverCard>
                <AgentControls agent={agent} />
              </li>
            ))}
          </ul>

          {agents.length === 0 && (
            <div className="mt-5 flex flex-col items-start gap-3 rounded-xl border border-dashed p-6">
              <p className="text-sm text-muted-foreground">
                No agents in this workspace yet.
              </p>
              <AddAgentButton />
            </div>
          )}
        </PaneBody>
      </ScrollArea>
    </>
  )
}

function MemberRows({ selectedId }: { selectedId?: string }) {
  const online = MEMBERS.filter((m) => m.online).length

  return (
    <>
      <PaneHeader
        crumbs={[
          <span key="title" className="font-medium">
            Members
          </span>,
        ]}
        actions={
          <span className="text-xs text-muted-foreground tabular-nums">
            {online} of {MEMBERS.length} online
          </span>
        }
      />

      <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
        <PaneBody>
          <h1 className="text-lg font-semibold">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            People in this workspace.
          </p>

          <ul role="list" className="mt-5 divide-y">
            {MEMBERS.map((member) => (
              <li
                key={member.id}
                aria-current={member.id === selectedId ? "true" : undefined}
                className={cn(
                  ROW,
                  "py-3",
                  member.id === selectedId &&
                    "-mx-2 rounded-lg bg-muted px-2 [&+li]:border-transparent"
                )}
              >
                <Avatar name={member.name} className="size-7" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium">
                    {member.name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {member.detail}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      member.online
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/40"
                    )}
                  />
                  {member.online ? "Online" : "Offline"}
                </span>
              </li>
            ))}
          </ul>
        </PaneBody>
      </ScrollArea>
    </>
  )
}

/**
 * Agents and members read alike — name, one line, a state dot — but they are
 * not the same list: an agent is mid-turn or idle and can be paused, added or
 * removed, while a member is simply online or not.
 */
export function PeopleView({
  kind,
  selectedId,
}: {
  kind: "agents" | "members"
  selectedId?: string
}) {
  return kind === "agents" ? (
    <AgentRows selectedId={selectedId} />
  ) : (
    <MemberRows selectedId={selectedId} />
  )
}
