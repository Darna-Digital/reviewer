import type {
  LocalDevDependencies,
  LocalDevFunctions,
} from "../interfaces/local-dev.interfaces";

export function createLocalDevFunctions(
  d: LocalDevDependencies
): LocalDevFunctions {
  /** Normalise a command definition, or null when it has nothing to run in. */
  const normalise = (
    name: string,
    command: string,
    repoPath: string
  ): { name: string; command: string; repoPath: string } | null => {
    const cmd = command.trim();
    if (cmd.length === 0 || repoPath.length === 0) return null;
    const trimmedName = name.trim();
    return {
      name: trimmedName.length > 0 ? trimmedName : cmd,
      command: cmd,
      repoPath,
    };
  };

  const create: LocalDevFunctions["create"] = async (
    name,
    command,
    repoPath
  ) => {
    const input = normalise(name, command, repoPath);
    if (input === null) return null;
    return d.sideEffects.create(input);
  };

  const update: LocalDevFunctions["update"] = async (
    id,
    name,
    command,
    repoPath
  ) => {
    const input = normalise(name, command, repoPath);
    if (input === null) return null;
    return d.sideEffects.update(id, input);
  };

  const remove: LocalDevFunctions["remove"] = (id) => d.sideEffects.remove(id);
  const start: LocalDevFunctions["start"] = (id) => d.sideEffects.start(id);
  const stop: LocalDevFunctions["stop"] = (id) => d.sideEffects.stop(id);
  const startAll: LocalDevFunctions["startAll"] = (repoPath) =>
    d.sideEffects.startAll(repoPath);
  const stopAll: LocalDevFunctions["stopAll"] = (repoPath) =>
    d.sideEffects.stopAll(repoPath);

  return { create, update, remove, start, stop, startAll, stopAll };
}
