import { errorReason } from "@/lib/errors";
import { isMultiRepo } from "@byconvo/core/workspace";
import type { WorkspaceInfo } from "@byconvo/core/workspace";
import type {
  RepoCommand,
  WorkspaceDependencies,
  WorkspaceFunctions,
} from "../interfaces/workspace.interfaces";

/**
 * A command-palette entry per root of the open project, so a multi-root project
 * can be moved through by typing rather than by aiming at the chip. The root
 * already being followed is left out — it is not a switch. A project holding
 * one root offers nothing, since there is nowhere to switch to.
 */
export const repoCommands = (
  workspace: WorkspaceInfo | undefined
): ReadonlyArray<RepoCommand> => {
  if (workspace === undefined || !isMultiRepo(workspace)) return [];
  return workspace.repos
    .filter((repo) => repo.path !== workspace.current)
    .map((repo) => ({
      id: `repo-switch:${repo.path}`,
      label: `Switch to ${repo.name}`,
      keywords: `repository root ${repo.name} ${repo.path} ${repo.branch ?? ""}`,
      path: repo.path,
    }));
};

export function createWorkspaceFunctions(
  d: WorkspaceDependencies
): WorkspaceFunctions {
  const {
    cacheWorkspace,
    invalidateAll,
    notifyError,
    refreshRepo,
    settle,
    setProject,
    setRepo,
  } = d.sideEffects;

  /**
   * Both flows are the same shape: swap the selection, then reload the app
   * around it. Seeding the cache first keeps the picker from flashing the old
   * project while the refetches land.
   *
   * The repository identity is reloaded on its own, and waited for, before the
   * rest: views ask git for things by name — the branch the history follows,
   * the file on screen — and those names come from the repository that was
   * open a moment ago. Reloading everything at once would send the arriving
   * root the departing root's branch, which git rejects outright. Settling in
   * between is what makes that ordering real: a reload is aimed at the queries
   * as they are right now, so the views have to have re-read the new identity
   * before the rest of them go out.
   */
  const select = async (
    change: () => Promise<Awaited<ReturnType<typeof setProject>>>,
    fallback: string
  ) => {
    let info: Awaited<ReturnType<typeof setProject>>;
    try {
      info = await change();
    } catch (cause) {
      notifyError(errorReason(cause, fallback));
      return null;
    }
    cacheWorkspace(info);
    await refreshRepo();
    await settle();
    await invalidateAll();
    return info;
  };

  const openProject: WorkspaceFunctions["openProject"] = (path) =>
    select(() => setProject(path), "could not open project");

  const openRepo: WorkspaceFunctions["openRepo"] = (path) =>
    select(() => setRepo(path), "could not open repository");

  const followRepo: WorkspaceFunctions["followRepo"] = async (path, current) =>
    path === current ? true : (await openRepo(path)) !== null;

  return { openProject, openRepo, followRepo };
}
