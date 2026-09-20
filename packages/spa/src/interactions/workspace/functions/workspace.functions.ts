import { errorReason } from "@/lib/errors";
import type {
  WorkspaceDependencies,
  WorkspaceFunctions,
} from "../interfaces/workspace.interfaces";

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
  } = d.sideEffects;

  /**
   * Swap the selection, then reload the app around it. Seeding the cache
   * first keeps the picker from flashing the old project while the refetches
   * land.
   *
   * The repository identity is reloaded on its own, and waited for, before the
   * rest: views ask git for things by name — the branch the history follows,
   * the file on screen — and those names come from the repository that was
   * open a moment ago. Reloading everything at once would send the arriving
   * repository the departing one's branch, which git rejects outright.
   * Settling in between is what makes that ordering real: a reload is aimed
   * at the queries as they are right now, so the views have to have re-read
   * the new identity before the rest of them go out.
   */
  const openProject: WorkspaceFunctions["openProject"] = async (path) => {
    let info: Awaited<ReturnType<typeof setProject>>;
    try {
      info = await setProject(path);
    } catch (cause) {
      notifyError(errorReason(cause, "could not open project"));
      return null;
    }
    cacheWorkspace(info);
    await refreshRepo();
    await settle();
    await invalidateAll();
    return info;
  };

  return { openProject };
}
