/**
 * ModeRail — code mode's left rail: the inbox on top, then the git surfaces and
 * the bottom dock's toggles. Collaboration mode has no rail — its sidebar
 * carries the equivalent. It reads the active surface from the route, so the
 * shells render it prop-free.
 */
import {
  IconFolders,
  IconGitCommit,
  IconGitFork,
  IconGitPullRequest,
  IconMessageCircle,
  IconPlayerPlay,
  IconSettings,
  IconTerminal2,
} from "@tabler/icons-react"
import { Link, useRouterState } from "@tanstack/react-router"
import { buttonVariants } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { InboxPopover } from "@/components/layout/inbox-popover"
import { cn } from "@/lib/utils"
import { isDesktop } from "@/lib/desktop"
import { useRepo } from "@/lib/queries"
import {
  openBottomTab,
  setUiPrefs,
  useUiPrefs,
  type BottomTab,
} from "@/lib/ui-prefs"

interface RailLink {
  to: string
  label: string
  icon: typeof IconGitCommit
  /** Route prefix that lights the button up. */
  match: string
  github?: boolean
}

const INBOX_MATCH = "/inbox"

const REVIEW_LINKS: RailLink[] = [
  {
    to: "/comments",
    label: "Comments — code & visual",
    icon: IconMessageCircle,
    match: "/comments",
  },
]

const GIT_LINKS: RailLink[] = [
  {
    to: "/browse",
    label: "Browse the project",
    icon: IconFolders,
    match: "/browse",
  },
  {
    to: "/commit",
    label: "Local changes",
    icon: IconGitCommit,
    match: "/commit",
  },
  {
    to: "/review",
    label: "Pull requests",
    icon: IconGitPullRequest,
    match: "/review",
    github: true,
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
    "relative rounded-lg text-muted-foreground [-webkit-app-region:no-drag]",
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

export function ModeRail() {
  const prefs = useUiPrefs()
  const repo = useRepo()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const hasGitHub = repo.data?.github != null

  const gitActive =
    prefs.bottomVisible &&
    (prefs.bottomTab === "branches" || prefs.bottomTab === "history")
  const servicesActive = prefs.bottomVisible && prefs.bottomTab === "services"
  const threadsActive = prefs.bottomVisible && prefs.bottomTab === "threads"

  const renderLink = ({ to, label, icon: Icon, match }: RailLink) => (
    <RailButton
      key={to}
      to={to}
      label={label}
      active={pathname.startsWith(match)}
    >
      <Icon className="size-5" />
    </RailButton>
  )

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
      {/* The inbox shares the top-bar row with the repo picker (web); on desktop
          the pt-10 spacer already clears that row. */}
      {isDesktop ? (
        <InboxPopover active={pathname.startsWith(INBOX_MATCH)} />
      ) : (
        <div className="flex h-10 w-full shrink-0 items-center justify-center">
          <InboxPopover active={pathname.startsWith(INBOX_MATCH)} />
        </div>
      )}
      <div className="my-1 h-px w-6 bg-border" />
      {GIT_LINKS.filter((l) => l.github !== true || hasGitHub).map(renderLink)}
      <div className="my-1 h-px w-6 bg-border" />
      {REVIEW_LINKS.map(renderLink)}
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
          active={pathname.startsWith("/settings")}
        >
          <IconSettings className="size-5" />
        </RailButton>
      </div>
    </nav>
  )
}
