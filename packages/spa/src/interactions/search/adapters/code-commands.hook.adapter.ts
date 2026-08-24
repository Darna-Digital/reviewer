import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { askForText } from "@/components/ui/alerts";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import { useRepo } from "@/lib/queries";
import { buildCodeCommands } from "../functions/commands.functions";
import type { Command } from "../interfaces/search.interfaces";

/** The code-mode commands, wired to the router and the git actions. */
export function useCodeCommands(): ReadonlyArray<Command> {
  const navigate = useNavigate();
  const git = useGitActions();
  const repo = useRepo();
  const hasGitHub = repo.data?.github != null;
  const currentBranch = repo.data?.currentBranch ?? null;

  return useMemo(
    () =>
      buildCodeCommands({
        data: { hasGitHub, currentBranch },
        sideEffects: {
          goTo: (route) => void navigate({ to: route }),
          refresh: () => git.refresh(),
          fetch: () => void git.fetch(),
          pull: () => void git.pull(),
          push: () => void git.push(),
          createBranch: (name, startPoint) =>
            void git.createBranch(name, startPoint),
          askForBranchName: () =>
            askForText({
              title: "Create a branch",
              label: "Branch name",
              placeholder: "feature/…",
              confirmLabel: "Create",
            }),
        },
      }),
    [navigate, git, hasGitHub, currentBranch]
  );
}
