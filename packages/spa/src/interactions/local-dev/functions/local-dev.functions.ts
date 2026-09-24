import { normalizeDevCwd } from "@reviewer/core/local-dev";
import type {
  DevCommandDraft,
  LocalDevDependencies,
  LocalDevFunctions,
} from "../interfaces/local-dev.interfaces";

/**
 * Every folder the repository's files sit in, the root (as "") first and the
 * rest sorted — what a command's folder is picked from.
 */
export const repoFolders = (paths: ReadonlyArray<string>): string[] => {
  const folders = new Set<string>();
  for (const path of paths) {
    const segments = path.split("/");
    for (let depth = 1; depth < segments.length; depth += 1) {
      folders.add(segments.slice(0, depth).join("/"));
    }
  }
  return ["", ...[...folders].sort((a, b) => a.localeCompare(b))];
};

export function createLocalDevFunctions(
  d: LocalDevDependencies
): LocalDevFunctions {
  /** Normalise a command definition, or null when it has nothing to run. */
  const normalise = (draft: DevCommandDraft): DevCommandDraft | null => {
    const cmd = draft.command.trim();
    if (cmd.length === 0) return null;
    const trimmedName = draft.name.trim();
    return {
      name: trimmedName.length > 0 ? trimmedName : cmd,
      command: cmd,
      cwd: normalizeDevCwd(draft.cwd),
    };
  };

  const create: LocalDevFunctions["create"] = async (draft) => {
    const input = normalise(draft);
    if (input === null) return null;
    return d.sideEffects.create(input);
  };

  const update: LocalDevFunctions["update"] = async (id, draft) => {
    const input = normalise(draft);
    if (input === null) return null;
    return d.sideEffects.update(id, input);
  };

  const remove: LocalDevFunctions["remove"] = (id) => d.sideEffects.remove(id);
  const start: LocalDevFunctions["start"] = (id) => d.sideEffects.start(id);
  const stop: LocalDevFunctions["stop"] = (id) => d.sideEffects.stop(id);
  const startAll: LocalDevFunctions["startAll"] = () =>
    d.sideEffects.startAll();
  const stopAll: LocalDevFunctions["stopAll"] = () => d.sideEffects.stopAll();

  return { create, update, remove, start, stop, startAll, stopAll };
}
