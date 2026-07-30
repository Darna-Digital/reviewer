import { Avatar } from "@/components/ui/avatar"
import { UNASSIGNED } from "@/interactions/collaboration/data/collaboration.mock"
import { cn } from "@/lib/utils"

/** An assignee's avatar, or a dashed placeholder while nobody owns the task. */
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
  return <Avatar name={name} className={cn("size-5", className)} />
}
