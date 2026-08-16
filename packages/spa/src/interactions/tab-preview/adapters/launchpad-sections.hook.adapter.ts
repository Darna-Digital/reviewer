/**
 * The launchpad's grid, bound to the window it is in: which sections the
 * project has is a question about the repository, and which conversations are
 * open is a question about the strip. Both the panel and the mill that
 * photographs it ask them the same way.
 */
import { useMemo } from "react";
import { useWindowTabs } from "@/interactions/window-tabs/adapters/window-tabs.store";
import { useRepo } from "@/lib/queries";
import {
  launchpadGroups,
  launchpadSections,
  sessionSections,
  type LaunchpadGroup,
  type LaunchpadSection,
} from "../functions/launchpad-sections.functions";

export function useLaunchpadGroups(): ReadonlyArray<LaunchpadGroup> {
  const repo = useRepo();
  const github = repo.data?.github != null;
  const { tabs } = useWindowTabs();
  const sessions = useMemo(() => sessionSections(tabs), [tabs]);
  return useMemo(
    () => launchpadGroups({ github, sessions }),
    [github, sessions]
  );
}

export function useLaunchpadSections(): ReadonlyArray<LaunchpadSection> {
  const groups = useLaunchpadGroups();
  return useMemo(() => launchpadSections(groups), [groups]);
}
