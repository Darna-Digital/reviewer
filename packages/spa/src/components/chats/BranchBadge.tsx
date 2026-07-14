/**
 * A subtle header chip naming the local checkout's branch — where the agent
 * runs, the chat equivalent of a terminal's cwd. Lives in the chat header
 * rather than under the composer so it stays out of the way.
 */
import { IconGitBranch } from "@tabler/icons-react"
import { useRepo } from "@/lib/queries"

export function BranchBadge({ branch }: { branch?: string | null }) {
  const repo = useRepo()
  const shown = branch ?? repo.data?.currentBranch ?? null
  if (shown === null || shown.length === 0) return null
  return (
    <span
      title="Local checkout — the branch the agent runs on"
      className="flex min-w-0 items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
    >
      <IconGitBranch className="size-3.5 shrink-0" />
      <span className="truncate">{shown}</span>
    </span>
  )
}
