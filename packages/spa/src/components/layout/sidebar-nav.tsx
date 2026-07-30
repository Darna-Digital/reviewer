/**
 * SidebarNav — the app's mode navigation, rendered at the top of whichever
 * sidebar the current page owns (the file tree in the git-review shell, the
 * chats/docs/comments lists in the workspace pages). It derives the active mode
 * from the route so call sites are prop-free.
 */
import {
  IconFileText,
  IconFolders,
  IconGitCommit,
  IconGitPullRequest,
  IconListCheck,
  IconMessageCircle,
  IconSend,
} from "@tabler/icons-react"
import { Link, useRouterState } from "@tanstack/react-router"
import type { AppMode } from "@/lib/api/types"
import { useRepo } from "@/lib/queries"
import { cn } from "@/lib/utils"

interface ModeDef {
  mode: AppMode
  to: string
  label: string
  icon: typeof IconGitCommit
}

const GIT_MODES: ModeDef[] = [
  { mode: "browse", to: "/browse", label: "Project", icon: IconFolders },
  {
    mode: "commit",
    to: "/commit",
    label: "Local changes",
    icon: IconGitCommit,
  },
  {
    mode: "review",
    to: "/review",
    label: "Pull requests",
    icon: IconGitPullRequest,
  },
]

const CONVERSATION_MODES: ModeDef[] = [
  { mode: "chats", to: "/chats", label: "Agent threads", icon: IconSend },
  {
    mode: "comments",
    to: "/comments",
    label: "Comments",
    icon: IconMessageCircle,
  },
]

const WORKSPACE_MODES: ModeDef[] = [
  { mode: "docs", to: "/docs", label: "Docs & plans", icon: IconFileText },
  { mode: "tasks", to: "/tasks", label: "Tasks", icon: IconListCheck },
]

// Only the git surfaces are linked for now. The workspace groups stay defined
// (and their routes stay live) for when they come back into the nav.
const ALL_GROUPS: ModeDef[][] = [GIT_MODES, CONVERSATION_MODES, WORKSPACE_MODES]
const LINKED_GROUPS = ALL_GROUPS.slice(0, 1)

const modeForPath = (pathname: string): AppMode =>
  pathname.startsWith("/review")
    ? "review"
    : pathname.startsWith("/browse")
      ? "browse"
      : pathname.startsWith("/chats")
        ? "chats"
        : pathname.startsWith("/comments")
          ? "comments"
          : pathname.startsWith("/docs")
            ? "docs"
            : pathname.startsWith("/tasks")
              ? "tasks"
              : pathname.startsWith("/settings")
                ? "settings"
                : "commit"

export function SidebarNav({ className }: { className?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const repo = useRepo()
  const mode = modeForPath(pathname)
  const hasGitHub = repo.data?.github != null

  const groups = LINKED_GROUPS.map((group) =>
    group.filter((m) => m.mode !== "review" || hasGitHub)
  )

  return (
    <nav className={cn("flex flex-col gap-2 p-2", className)}>
      {groups.map((group) => (
        <div key={group[0]?.mode} className="flex flex-col gap-0.5">
          {group.map(({ mode: m, to, label, icon: Icon }) => (
            <Link
              key={m}
              to={to}
              className={cn(
                "flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-muted-foreground transition-colors outline-none select-none hover:bg-elevate hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
                m === mode && "bg-muted text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}

/** The nav on its own, for pages whose body has no sidebar of its own. */
export function NavSidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r">
      <SidebarNav />
    </aside>
  )
}
