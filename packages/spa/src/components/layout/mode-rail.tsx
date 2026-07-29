import {
  IconFolders,
  IconGitCommit,
  IconGitFork,
  IconGitPullRequest,
  IconMessageCircle,
  IconPlayerPlay,
  IconSend,
  IconSettings,
  IconTerminal2,
} from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { isDesktop } from "@/lib/desktop"
import type { AppMode } from "@/lib/api/types"
import {
  openBottomTab,
  setUiPrefs,
  useUiPrefs,
  type BottomTab,
} from "@/lib/ui-prefs"

interface ModeRailProps {
  mode: AppMode
  hasGitHub: boolean
}

interface ModeDef {
  mode: AppMode
  to: string
  label: string
  icon: typeof IconGitCommit
}

// The git-review modes (rendered by AppShell).
const GIT_MODES: ModeDef[] = [
  {
    mode: "browse",
    to: "/browse",
    label: "Browse the project",
    icon: IconFolders,
  },
  {
    mode: "commit",
    to: "/commit",
    label: "Commit — local changes",
    icon: IconGitCommit,
  },
  {
    mode: "review",
    to: "/review",
    label: "Pull requests",
    icon: IconGitPullRequest,
  },
]

// Conversation surfaces — agent threads and comments, in their own rail group
// below the git modes.
const WORKSPACE_CONVERSATION: ModeDef[] = [
  {
    mode: "chats",
    to: "/chats",
    label: "Agent threads",
    icon: IconSend,
  },
  {
    mode: "comments",
    to: "/comments",
    label: "Comments — code & visual",
    icon: IconMessageCircle,
  },
]

function RailButton({
  label,
  active,
  onClick,
  to,
  children,
}: {
  label: string
  active?: boolean
  onClick?: () => void
  to?: string
  children: React.ReactNode
}) {
  const className = cn(
    buttonVariants({ variant: "ghost", size: "icon" }),
    "rounded-lg text-muted-foreground [-webkit-app-region:no-drag]",
    active && "bg-muted text-foreground"
  )
  return (
    <Tooltip>
      <TooltipTrigger
        className={className}
        aria-label={label}
        render={
          to ? (
            <Link to={to} onClick={onClick} />
          ) : (
            <button type="button" onClick={onClick} />
          )
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Show a bottom-dock tab, or hide the dock if that tab is already active. */
function toggleBottomTab(tab: BottomTab, current: BottomTab, visible: boolean) {
  if (visible && current === tab) {
    setUiPrefs({ bottomVisible: false })
    return
  }
  openBottomTab(tab)
}

export function ModeRail({ mode, hasGitHub }: ModeRailProps) {
  const prefs = useUiPrefs()
  const gitActive =
    prefs.bottomVisible &&
    (prefs.bottomTab === "branches" || prefs.bottomTab === "history")
  const servicesActive = prefs.bottomVisible && prefs.bottomTab === "services"
  const threadsActive = prefs.bottomVisible && prefs.bottomTab === "threads"

  const renderMode = ({ mode: m, to, label, icon: Icon }: ModeDef) => (
    <RailButton key={m} to={to} label={label} active={mode === m}>
      <Icon className="size-5" />
    </RailButton>
  )

  const gitModes = GIT_MODES.filter((m) => m.mode !== "review" || hasGitHub)
  const [firstGit, ...restGit] = gitModes

  return (
    <nav
      className={cn(
        "flex h-full w-12 shrink-0 flex-col items-center gap-1 pb-2",
        // In the desktop shell the macOS traffic lights sit over the rail's
        // top-left. Reserve a draggable title-bar strip above the buttons (the
        // height of the top bar) so they clear the lights; empty strip drags the
        // window, the buttons opt back out via [-webkit-app-region:no-drag].
        isDesktop && "pt-10 [-webkit-app-region:drag]"
      )}
    >
      {/* First mode sits in an h-10 slot so it shares the top-bar row with the
          repo picker (web). On desktop the pt-10 spacer already clears that row. */}
      {firstGit &&
        (isDesktop ? (
          renderMode(firstGit)
        ) : (
          <div className="flex h-10 w-full shrink-0 items-center justify-center">
            {renderMode(firstGit)}
          </div>
        ))}
      {restGit.map(renderMode)}
      <div className="my-1 h-px w-6 bg-border" />
      {WORKSPACE_CONVERSATION.map(renderMode)}
      <div className="mt-auto flex flex-col items-center gap-1">
        <RailButton
          label="Branches & History"
          active={gitActive}
          onClick={() => {
            const gitTab =
              prefs.bottomTab === "history" ? "history" : "branches"
            if (prefs.bottomVisible && gitActive) {
              setUiPrefs({ bottomVisible: false })
              return
            }
            openBottomTab(gitTab)
          }}
        >
          <IconGitFork className="size-5" />
        </RailButton>
        <RailButton
          label="Services"
          active={servicesActive}
          onClick={() =>
            toggleBottomTab("services", prefs.bottomTab, prefs.bottomVisible)
          }
        >
          <IconPlayerPlay className="size-5" />
        </RailButton>
        <RailButton
          label="Terminal threads"
          active={threadsActive}
          onClick={() =>
            toggleBottomTab("threads", prefs.bottomTab, prefs.bottomVisible)
          }
        >
          <IconTerminal2 className="size-5" />
        </RailButton>
        <RailButton
          to="/settings"
          label="Settings"
          active={mode === "settings"}
        >
          <IconSettings className="size-5" />
        </RailButton>
      </div>
    </nav>
  )
}
