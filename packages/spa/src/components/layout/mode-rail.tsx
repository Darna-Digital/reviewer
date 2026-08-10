/**
 * ModeRail — code mode's left rail: the git surfaces on top, then the bottom
 * dock's toggles. Collaboration mode has no rail — its sidebar carries the
 * equivalent. It reads the active surface from the route, so the shells render
 * it prop-free. The window's own chrome (traffic lights, tabs) sits above it in
 * the WindowFrame, so the rail starts at the content edge.
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
} from "@tabler/icons-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// The Sessions tab is the way into the threads now, so the rail's inbox is parked.
// import { ChatsInboxPopover } from "@/interactions/chats/components/chats-inbox-popover";
import { cn } from "@/lib/utils";
import { useRepo } from "@/lib/queries";
import {
  openBottomTab,
  setUiPrefs,
  useUiPrefs,
  type BottomTab,
} from "@/lib/ui-prefs";

interface RailLink {
  to: string;
  label: string;
  icon: typeof IconGitCommit;
  /** Route prefix that lights the button up. */
  match: string;
  github?: boolean;
}

/** Code mode's inbox is the repo's agent threads. */
// const INBOX_MATCH = "/modes/agent-session";

const REVIEW_LINKS: RailLink[] = [
  {
    to: "/modes/code/comments",
    label: "Comments — code & visual",
    icon: IconMessageCircle,
    match: "/modes/code/comments",
  },
];

const GIT_LINKS: RailLink[] = [
  {
    to: "/modes/code/browse",
    label: "Browse the project",
    icon: IconFolders,
    match: "/modes/code/browse",
  },
  {
    to: "/modes/code/commit",
    label: "Local changes",
    icon: IconGitCommit,
    match: "/modes/code/commit",
  },
  {
    to: "/modes/code/review",
    label: "Pull requests",
    icon: IconGitPullRequest,
    match: "/modes/code/review",
    github: true,
  },
];

function RailButton({
  label,
  active,
  onClick,
  to,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  to?: string;
  children: React.ReactNode;
}) {
  const className = cn(
    buttonVariants({ variant: "ghost", size: "icon" }),
    "relative text-muted-foreground [-webkit-app-region:no-drag]",
    active && "bg-muted text-foreground"
  );
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
  );
}

/** Show a bottom-dock tab, or hide the dock if that tab is already active. */
function toggleBottomTab(tab: BottomTab, current: BottomTab, visible: boolean) {
  if (visible && current === tab) {
    setUiPrefs({ bottomVisible: false });
    return;
  }
  openBottomTab(tab);
}

export function ModeRail() {
  const prefs = useUiPrefs();
  const repo = useRepo();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hasGitHub = repo.data?.github != null;

  const gitActive =
    prefs.bottomVisible &&
    (prefs.bottomTab === "branches" || prefs.bottomTab === "history");
  const servicesActive = prefs.bottomVisible && prefs.bottomTab === "services";
  const threadsActive = prefs.bottomVisible && prefs.bottomTab === "threads";

  const renderLink = ({ to, label, icon: Icon, match }: RailLink) => (
    <RailButton
      key={to}
      to={to}
      label={label}
      active={pathname.startsWith(match)}
    >
      <Icon className="size-5" />
    </RailButton>
  );

  return (
    <nav className="relative flex h-full w-12 shrink-0 flex-col items-center py-2">
      {/* The rail's right edge is drawn over its last pixel column rather than
          as a `border-r`, which would take that pixel out of the content box
          and centre every icon half a pixel left of where the toolbar's own
          `px-2` puts them — the icons visibly stepping sideways on the way in
          and out of collaboration mode, which has no rail. */}
      <div className="absolute top-0 right-0 h-full w-px bg-border" />
      <div className="flex w-full flex-1 flex-col items-center gap-1">
        {GIT_LINKS.filter((l) => l.github !== true || hasGitHub).map(
          renderLink
        )}
        <div className="my-1 h-px w-6 bg-border" />
        {REVIEW_LINKS.map(renderLink)}
        <div className="mt-auto flex flex-col items-center gap-1">
          <RailButton
            label="Branches & History"
            active={gitActive}
            onClick={() => {
              const gitTab =
                prefs.bottomTab === "history" ? "history" : "branches";
              if (prefs.bottomVisible && gitActive) {
                setUiPrefs({ bottomVisible: false });
                return;
              }
              openBottomTab(gitTab);
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
      </div>
    </nav>
  );
}
