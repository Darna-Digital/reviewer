import { createFileRoute } from "@tanstack/react-router";
import {
  GitPage,
  type GitTab,
  isGitTab,
} from "@/interactions/git-mode/components/git-page";

export interface GitSearch {
  readonly tab: GitTab;
}

export const Route = createFileRoute("/_app/modes/git")({
  validateSearch: (search: Record<string, unknown>): GitSearch => ({
    tab: isGitTab(search["tab"]) ? search["tab"] : "branches",
  }),
  component: GitRoute,
});

function GitRoute() {
  const { tab } = Route.useSearch();
  return <GitPage tab={tab} />;
}
