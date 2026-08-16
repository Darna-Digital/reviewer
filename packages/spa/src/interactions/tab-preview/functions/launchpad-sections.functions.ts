/**
 * What the launchpad is a way into: the project's own surfaces, and whatever
 * conversations are open, laid out as cards.
 *
 * The project half lists places rather than tabs. The strip along the top of the
 * window already shows what is open; what it cannot show is the rest of the app
 * — the surfaces reached from a rail, a dock or nowhere at all — so each of
 * those gets a card, showing that place as it looks right now.
 *
 * A place is a location and nothing else, so a dock that has to be open for the
 * section to make sense is a location too — `/modes/code/history` is the local
 * changes page with the history dock pulled up, and picking the card leaves the
 * window exactly where the picture was taken.
 *
 * The sessions half is the exception, and is a list of tabs on purpose: a
 * conversation is not a place in the app, it is one of however many you have on
 * the go, and the launchpad is where you see them all at once.
 */
import {
  IconFolders,
  IconGitCommit,
  IconGitPullRequest,
  IconHistory,
  IconMessage,
  IconMessages,
  IconPlayerPlay,
  IconTerminal2,
} from "@tabler/icons-react";
import { isFeatureEnabled } from "@byconvo/feature-flags";
import type { WindowTab } from "@/interactions/window-tabs/interfaces/window-tabs.interfaces";
import type { WorkMode } from "@/lib/ui-prefs";

export interface LaunchpadSection {
  /**
   * What tells one card from another. Two unnamed sessions are both at the
   * composer's own location, so the location cannot be the name.
   */
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly icon: typeof IconGitCommit;
  /** The mode the app is framed in once you are there. */
  readonly mode: WorkMode;
  /**
   * The tab this card stands for, when it stands for one rather than for a
   * place. A conversation is something you have open and can be done with, so
   * it wears the same ✕ the strip gives it; a section of the app is somewhere
   * that is always there, and closing it would mean nothing.
   */
  readonly tabId?: string;
}

export interface LaunchpadGroup {
  readonly title: string;
  readonly sections: ReadonlyArray<LaunchpadSection>;
  /** Whether the group ends with the tile that mints a conversation. */
  readonly minting: boolean;
}

/** Sections the project has to be on GitHub to have anything to show. */
const GITHUB_SECTIONS = new Set(["/modes/code/review"]);

const CODE_SECTIONS: ReadonlyArray<LaunchpadSection> = [
  {
    id: "/modes/code/commit",
    href: "/modes/code/commit",
    title: "Local changes",
    icon: IconGitCommit,
    mode: "code",
  },
  {
    id: "/modes/code/history",
    href: "/modes/code/history",
    title: "Branch history",
    icon: IconHistory,
    mode: "code",
  },
  {
    id: "/modes/code/browse",
    href: "/modes/code/browse",
    title: "Browse",
    icon: IconFolders,
    mode: "code",
  },
  {
    id: "/modes/code/review",
    href: "/modes/code/review",
    title: "Pull requests",
    icon: IconGitPullRequest,
    mode: "code",
  },
  {
    id: "/modes/code/local-dev",
    href: "/modes/code/local-dev",
    title: "Services",
    icon: IconPlayerPlay,
    mode: "code",
  },
  {
    id: "/modes/code/threads",
    href: "/modes/code/threads",
    title: "Terminals",
    icon: IconTerminal2,
    mode: "code",
  },
];

/**
 * The list of every conversation there has been, which is a place like any
 * other — and the one card in its group that is not a conversation, so it leads
 * the row the way the group's own name would.
 */
const SESSIONS_LIST: LaunchpadSection = {
  id: "/modes/agent-session",
  href: "/modes/agent-session",
  title: "All sessions",
  icon: IconMessages,
  mode: "code",
};

/** The conversations that are open, as cards, in the order the strip holds them. */
export const sessionSections = (
  tabs: ReadonlyArray<WindowTab>
): ReadonlyArray<LaunchpadSection> =>
  tabs
    .filter((tab) => tab.kind === "session")
    .map((tab) => ({
      id: tab.id,
      tabId: tab.id,
      href: tab.href,
      title: tab.title,
      icon: IconMessage,
      mode: "code" as const,
    }));

/**
 * The grid, in the order it is read: the project first, then the conversations
 * open on it.
 *
 * A section the project cannot answer is left out rather than shown empty — a
 * card of a page saying there is nothing here is worse than no card at all —
 * and with sessions switched off the whole second group goes the same way.
 */
export function launchpadGroups({
  github,
  sessions,
}: {
  readonly github: boolean;
  readonly sessions: ReadonlyArray<LaunchpadSection>;
}): ReadonlyArray<LaunchpadGroup> {
  return [
    {
      title: "Project",
      sections: CODE_SECTIONS.filter(
        (section) => github || !GITHUB_SECTIONS.has(section.href)
      ),
      minting: false,
    },
    ...(isFeatureEnabled("sessions-button")
      ? [
          {
            title: "Sessions",
            sections: [SESSIONS_LIST, ...sessions],
            minting: true,
          },
        ]
      : []),
  ];
}

/** Every section the grid is showing, in the order the cards are drawn. */
export const launchpadSections = (
  groups: ReadonlyArray<LaunchpadGroup>
): ReadonlyArray<LaunchpadSection> =>
  groups.flatMap((group) => [...group.sections]);
