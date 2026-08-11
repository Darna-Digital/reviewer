/**
 * WorkspaceShell — the layout for the workspace feature pages (chats, docs,
 * tasks/settings). It mirrors AppShell's frame — the same toolbar over the
 * content and the shared bottom dock — inside the window frame both shells
 * share. Code mode keeps the repo picker and branch switcher; collaboration
 * mode drops both, along with the dock and the mode rail, since its own sidebar
 * carries what the rail held. A session drops the rail and the picker too — it
 * is one conversation, not a way around the project. Each feature page renders
 * its own header and body into the `<Outlet />`.
 */
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { IconRepeat } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { BranchSwitcher } from "@/components/layout/branch-switcher";
import { GitBottomDock } from "@/components/layout/git-bottom-dock";
import { ModeRail } from "@/components/layout/mode-rail";
// Only code mode is offered for now, so the mode chip stays parked.
// import { ModeSelector } from "@/components/layout/mode-selector";
import { AgentStrip } from "@/interactions/session-agents/components/agent-strip";
import { NewSessionButton } from "@/interactions/chats/components/new-session-button";
import { SessionSearch } from "@/interactions/chats/components/session-search";
import { WindowFrame } from "@/components/layout/window-frame";
import { ProjectPicker } from "@/interactions/workspace/components/project-picker";
import { RepoSwitcher } from "@/interactions/workspace/components/repo-switcher";
import {
  useRepoCommands,
  useWorkspaceActions,
} from "@/interactions/workspace/adapters/workspace.hook.adapter";
import { SearchMenu } from "@/interactions/search/components/search-menu";
import { CollaborationSearch } from "@/interactions/collaboration/components/collaboration-search";
import { NewTaskButton } from "@/interactions/collaboration/components/task-create-dialog";
import { WorkspacePicker } from "@/interactions/collaboration/components/workspace-picker";
import { useGitActions } from "@/interactions/git-actions/adapters/git-actions.hook.adapter";
import { useRegisterCommands } from "@/interactions/search/adapters/search.store";
import type { Command } from "@/interactions/search/interfaces/search.interfaces";
import {
  useBranches,
  useRemoteBranches,
  useRepo,
  useWorkspace,
} from "@/lib/queries";
import { useUiPrefs } from "@/lib/ui-prefs";
import { activeWorkMode } from "@/lib/work-mode";

export function WorkspaceShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const repo = useRepo();
  const workspace = useWorkspace();
  const workspaceActions = useWorkspaceActions();
  const branches = useBranches();
  const remoteBranches = useRemoteBranches();
  const git = useGitActions();
  const prefs = useUiPrefs();
  const [pickerOpen, setPickerOpen] = useState(false);

  const current = workspace.data?.current ?? null;
  const isSettings = pathname.startsWith("/settings");
  // Collaboration mode hides the git chrome — no branch switcher, no dock.
  const collaborating =
    activeWorkMode(pathname, prefs.workMode) === "collaboration";
  // A session is one conversation, held by its own tab: the rail and the repo
  // picker are how you move around the project, and neither is what this
  // surface is for.
  const inSession = pathname.startsWith("/modes/agent-session");

  // The picker is this shell's own, so the command that raises it is too.
  const shellCommands = useMemo<ReadonlyArray<Command>>(
    () => [
      {
        id: "project-switch",
        label: "Open Project…",
        group: "Project",
        icon: IconRepeat,
        keywords: "open change repository folder picker switch",
        run: () => setPickerOpen(true),
      },
    ],
    []
  );
  useRegisterCommands("workspace-shell", shellCommands);
  useRepoCommands(workspace.data);

  return (
    <WindowFrame>
      {!collaborating && !inSession && <ModeRail />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-11 shrink-0 items-center gap-2 px-2">
          {/* <ModeSelector /> */}
          {collaborating && (
            <>
              <WorkspacePicker />
              <NewTaskButton />
              <CollaborationSearch />
            </>
          )}
          {!collaborating && !inSession && (
            <>
              <ProjectPicker
                workspace={workspace.data}
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                onChosen={() => {}}
              />
              <RepoSwitcher
                workspace={workspace.data}
                onSelect={(path) => void workspaceActions.openRepo(path)}
              />
            </>
          )}
          {/* A session's bar opens with the two things that act on the list —
              minting one and finding one — and parks the agents answering it at
              the far end, where they read as status rather than as controls. */}
          {inSession && (
            <>
              <NewSessionButton />
              <SessionSearch />
              <div className="flex-1" />
              <AgentStrip />
            </>
          )}
          {current !== null && !collaborating && !inSession && (
            <BranchSwitcher
              current={repo.data?.currentBranch ?? null}
              branches={branches.data ?? []}
              remoteBranches={remoteBranches.data ?? []}
              busy={false}
              onCheckout={(b) => void git.checkout(b)}
              onCheckoutAndUpdate={(b) => void git.checkoutAndUpdate(b)}
              onCreateBranch={(name, sp) => void git.createBranch(name, sp)}
              onCompare={(base, head) =>
                void navigate({
                  to: "/modes/code/browse/range",
                  search: { base, head },
                })
              }
              onMerge={(b) => void git.merge(b)}
              onRebase={(o) => void git.rebase(o)}
              onRenameBranch={(from, to) => void git.renameBranch(from, to)}
              onDeleteBranch={(name) => void git.deleteBranch(name)}
              onFetch={() => void git.fetch()}
              onPull={() => void git.pull()}
              onPush={() => void git.push()}
            />
          )}
          {!collaborating && !inSession && <SearchMenu />}
        </header>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-t">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {current === null && !isSettings ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
                <div className="font-medium">No repository selected</div>
                <div className="text-muted-foreground">
                  Open one from the repo picker above to use this workspace.
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </div>
          {current !== null && !collaborating && <GitBottomDock />}
        </div>
      </div>
    </WindowFrame>
  );
}
