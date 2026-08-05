import { Avatar } from "@/components/ui/avatar"
import { AgentHoverCard } from "@/interactions/collaboration/components/agent-hover-card"
import { AgentMark } from "@/interactions/collaboration/components/agent-mark"
import {
  findAgentByName,
  UNASSIGNED,
} from "@/interactions/collaboration/data/collaboration.mock"
import { cn } from "@/lib/utils"

/**
 * An assignee's mark: a brand glyph when an agent owns the task, initials when
 * a person does, and a dashed placeholder while nobody does.
 */
export function AssigneeAvatar({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  if (name === UNASSIGNED) {
    return (
      <span
        className={cn(
          "size-5 shrink-0 rounded-full border border-dashed border-muted-foreground/50",
          className
        )}
      />
    )
  }
  const agent = findAgentByName(name)
  if (agent !== undefined) {
    return (
      <AgentHoverCard agent={agent}>
        <AgentMark kind={agent.kind} className={cn("size-5", className)} />
      </AgentHoverCard>
    )
  }
  return <Avatar name={name} className={cn("size-5", className)} />
}
