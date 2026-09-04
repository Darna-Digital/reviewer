import {
  IconArrowDown,
  IconArrowUp,
  IconCloudDownload,
  IconFolder,
  IconGitBranch,
  IconGitCommit,
  IconGitPullRequest,
  IconRefresh,
  IconSettings,
} from "@tabler/icons-react";
import type { Command } from "../interfaces/search.interfaces";

/** The pages the command list can send you to. */
export type CodeRoute =
  | "/modes/code/review"
  | "/modes/code/reviews"
  | "/modes/code/browse"
  | "/settings";

export interface CodeCommandDependencies {
  data: {
    /** Pull requests only exist when the repo has a GitHub remote. */
    readonly hasGitHub: boolean;
    readonly currentBranch: string | null;
  };
  sideEffects: {
    readonly goTo: (route: CodeRoute) => void;
    readonly refresh: () => void;
    readonly fetch: () => void;
    readonly pull: () => void;
    readonly push: () => void;
    readonly createBranch: (name: string, startPoint: string | null) => void;
    /** Resolves to the name to branch to, or null when the user backs out. */
    readonly askForBranchName: () => Promise<string | null>;
  };
}

/**
 * The commands every code-mode page offers: where to go, and what to do with
 * git. The git ones sit in the dialog's own Git list rather than the root one,
 * so the command list you land on stays short. Shell-specific commands (panel
 * toggles, the repo picker) are registered by the shell that owns them instead.
 */
export const buildCodeCommands = (
  d: CodeCommandDependencies
): ReadonlyArray<Command> => {
  const { goTo, ...git } = d.sideEffects;
  return [
    {
      id: "go-review",
      label: "Go to Review",
      group: "Navigation",
      icon: IconGitCommit,
      keywords: "commit working tree changes diff local",
      run: () => goTo("/modes/code/review"),
    },
    {
      id: "go-reviews",
      label: "Go to Reviews",
      group: "Navigation",
      icon: IconGitPullRequest,
      keywords: "review pr github pull requests",
      run: () => goTo("/modes/code/reviews"),
    },
    {
      id: "go-browse",
      label: "Browse the Project",
      group: "Navigation",
      icon: IconFolder,
      keywords: "files history commits explore",
      run: () => goTo("/modes/code/browse"),
    },
    {
      id: "go-settings",
      label: "Open Settings",
      group: "Navigation",
      icon: IconSettings,
      keywords: "theme dark light system appearance preferences",
      run: () => goTo("/settings"),
    },
    {
      id: "git-refresh",
      submenu: "git",
      label: "Refresh",
      group: "Git",
      icon: IconRefresh,
      keywords: "reload sync",
      run: git.refresh,
    },
    {
      id: "git-fetch",
      submenu: "git",
      label: "Fetch",
      group: "Git",
      icon: IconCloudDownload,
      keywords: "remote",
      run: git.fetch,
    },
    {
      id: "git-pull",
      submenu: "git",
      label: "Pull",
      group: "Git",
      icon: IconArrowDown,
      keywords: "remote update",
      run: git.pull,
    },
    {
      id: "git-push",
      submenu: "git",
      label: "Push",
      group: "Git",
      icon: IconArrowUp,
      keywords: "remote upload",
      run: git.push,
    },
    {
      id: "git-branch",
      submenu: "git",
      label: "Create Branch…",
      group: "Git",
      icon: IconGitBranch,
      keywords: "new checkout",
      run: () => {
        void git.askForBranchName().then((answer) => {
          const name = answer?.trim();
          if (name === undefined || name.length === 0) return;
          git.createBranch(name, d.data.currentBranch);
        });
      },
    },
  ];
};
