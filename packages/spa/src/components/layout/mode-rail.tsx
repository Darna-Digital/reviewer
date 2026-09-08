/**
 * ModeRail — the left rail: the git surfaces on top, then the bottom dock's
 * toggles. It reads the active surface from the route, so the shells render
 * it prop-free. The window's own chrome (traffic lights, tabs) sits above it in
 * the WindowFrame, so the rail starts at the content edge.
 */
import {
  IconFolder,
  IconGitBranch,
  IconGitCommit,
  IconGitPullRequest,
  IconHistory,
  IconPlayerPlay,
  IconSearch,
  IconTerminal2,
} from "@tabler/icons-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { restoreDock, showDockPage } from "@/components/layout/dock-expansion";
import { Rail, RailButton, RailFoot } from "@/components/layout/rail";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchMenuItems } from "@/interactions/search/components/search-menu";
// The Sessions tab is the way into the threads now, so the rail's inbox is parked.
// import { ChatsInboxPopover } from "@/interactions/chats/components/chats-inbox-popover";
import { REVIEW_HREF, REVIEWS_HREF, shellRoute } from "@/lib/shell-route";
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
  /** The route that lights the button up, it or anything under it. */
  match: string;
}

/** Code mode's inbox is the repo's agent threads. */
// const INBOX_MATCH = "/modes/agent-session";

const GIT_LINKS: RailLink[] = [
  {
    to: "/modes/code/browse",
    label: "Browse the project",
    icon: IconFolder,
    match: "/modes/code/browse",
  },
  {
    to: REVIEW_HREF,
    label: "Review",
    icon: IconGitCommit,
    match: REVIEW_HREF,
  },
  {
    to: REVIEWS_HREF,
    label: "Merge requests",
    icon: IconGitPullRequest,
    match: REVIEWS_HREF,
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
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Which surface has the window to itself, if one has. A rail button is how you
  // get from one of them to another, so on a page it moves between the pages
  // rather than dropping the window back into the drawer for every click; the
  // one you are already on is the click that puts it down.
  const route = shellRoute(pathname);
  const expandedTab = route.kind === "dock" ? route.tab : null;
  const active = (tab: BottomTab): boolean =>
    expandedTab === null
      ? prefs.bottomVisible && prefs.bottomTab === tab
      : expandedTab === tab;
  const pick = (tab: BottomTab) => {
    if (expandedTab === null) {
      toggleBottomTab(tab, prefs.bottomTab, prefs.bottomVisible);
      return;
    }
    if (expandedTab === tab) restoreDock(navigate, tab);
    else showDockPage(navigate, tab);
  };

  const renderLink = ({ to, label, icon: Icon, match }: RailLink) => (
    <RailButton
      key={to}
      to={to}
      label={label}
      active={pathname === match || pathname.startsWith(`${match}/`)}
    >
      <Icon className="size-4" />
    </RailButton>
  );

  return (
    <Rail label="Project">
      {GIT_LINKS.map(renderLink)}
      {/* Searching the project is something you do *to* the surfaces above, not
          a fourth surface, so it follows them rather than joining them — and it
          is here rather than in the header because this is the column you
          already reach to when you want to be somewhere else. */}
      <DropdownMenu>
        <RailButton
          label="Search"
          render={<DropdownMenuTrigger render={<button type="button" />} />}
        >
          <IconSearch className="size-4" />
        </RailButton>
        <DropdownMenuContent side="right" align="start" className="min-w-56">
          <SearchMenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
      <RailFoot>
        <RailButton
          label="Branches"
          active={active("branches")}
          onClick={() => pick("branches")}
        >
          <IconGitBranch className="size-4" />
        </RailButton>
        <RailButton
          label="History"
          active={active("history")}
          onClick={() => pick("history")}
        >
          <IconHistory className="size-4" />
        </RailButton>
        <RailButton
          label="Services"
          active={active("services")}
          onClick={() => pick("services")}
        >
          <IconPlayerPlay className="size-4" />
        </RailButton>
        <RailButton
          label="Terminal sessions"
          active={active("threads")}
          onClick={() => pick("threads")}
        >
          <IconTerminal2 className="size-4" />
        </RailButton>
      </RailFoot>
    </Rail>
  );
}
