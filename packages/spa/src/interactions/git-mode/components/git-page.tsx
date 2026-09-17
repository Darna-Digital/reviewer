/**
 * The git mode: the branches, the history and the merge requests, as tabs of
 * one page with the window to it.
 *
 * These are the dock's surfaces given the canvas — the same components, so a
 * search typed in the drawer's branch list is the search here, and a history
 * filter set here is the one the diff's per-file history reflects. The merge
 * requests moved in from the mode rail, where they were the one surface that
 * was a list rather than code: they are git's, and this is git's page.
 *
 * Which tab is open is the URL's to say (`?tab=`), so the window tab that
 * remembers this page brings the surface back with it.
 */
import { useNavigate } from "@tanstack/react-router";
import {
  IconGitBranch,
  IconGitPullRequest,
  IconHistory,
} from "@tabler/icons-react";
import { GitBottomDock } from "@/components/layout/git-bottom-dock";
import { TabsSubtle, TabsSubtleItem } from "@/components/ui/tabs-subtle";
import { ReviewsPage } from "@/interactions/reviews/components/reviews-page";
import { GIT_HREF } from "@/lib/shell-route";

export type GitTab = "branches" | "history" | "reviews";

export const GIT_TABS: ReadonlyArray<{
  readonly id: GitTab;
  readonly label: string;
  readonly icon: typeof IconGitBranch;
}> = [
  { id: "branches", label: "Branches", icon: IconGitBranch },
  { id: "history", label: "History", icon: IconHistory },
  { id: "reviews", label: "Merge requests", icon: IconGitPullRequest },
];

export const isGitTab = (value: unknown): value is GitTab =>
  GIT_TABS.some((tab) => tab.id === value);

export function GitPage({ tab }: { readonly tab: GitTab }) {
  const navigate = useNavigate();
  const selectedIndex = Math.max(
    0,
    GIT_TABS.findIndex((candidate) => candidate.id === tab)
  );

  return (
    <div className="app-sheet flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center border-b border-hairline px-1">
        <TabsSubtle
          idPrefix="git-mode"
          className="min-w-0"
          selectedIndex={selectedIndex}
          onSelect={(index) => {
            const next = GIT_TABS[index];
            if (next === undefined) return;
            void navigate({ to: GIT_HREF, search: { tab: next.id } });
          }}
        >
          {GIT_TABS.map((candidate, index) => (
            <TabsSubtleItem
              key={candidate.id}
              index={index}
              label={candidate.label}
              icon={candidate.icon}
            />
          ))}
        </TabsSubtle>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {tab === "reviews" ? (
          <ReviewsPage />
        ) : (
          <GitBottomDock expandedTab={tab} chromeless />
        )}
      </div>
    </div>
  );
}
