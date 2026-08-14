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
  IconGitPullRequest,
  IconHistory,
  IconPlayerPlay,
  IconTerminal2,
} from "@tabler/icons-react";
import { useRouterState } from "@tanstack/react-router";
import { Rail, RailButton, RailFoot } from "@/components/layout/rail";
// The Sessions tab is the way into the threads now, so the rail's inbox is parked.
// import { ChatsInboxPopover } from "@/interactions/chats/components/chats-inbox-popover";
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

  const historyActive = prefs.bottomVisible && prefs.bottomTab === "history";
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
    <Rail label="Project">
      {GIT_LINKS.filter((l) => l.github !== true || hasGitHub).map(renderLink)}
      <RailFoot>
        <RailButton
          label="History"
          active={historyActive}
          onClick={() =>
            toggleBottomTab("history", prefs.bottomTab, prefs.bottomVisible)
          }
        >
          <IconHistory className="size-5" />
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
          label="Terminal sessions"
          active={threadsActive}
          onClick={() =>
            toggleBottomTab("threads", prefs.bottomTab, prefs.bottomVisible)
          }
        >
          <IconTerminal2 className="size-5" />
        </RailButton>
      </RailFoot>
    </Rail>
  );
}
