/**
 * Where the next session runs: on this machine, or handed to reviewer cloud.
 *
 * Held the way `run-location.store` is, and for the same reasons: it describes
 * the session that does not exist yet, the composer that asks unmounts on every
 * navigation, and sending work to the cloud is a way of working rather than a
 * decision to make again each time — so it is sticky for the window and not
 * persisted, a reloaded window opening on the safe answer.
 *
 * The cloud repository chosen for the run travels with it: a target of "cloud"
 * without a repository is not a place to run anything.
 */
import { useSyncExternalStore } from "react";

export type RunTarget = "local" | "cloud";

export interface RunTargetState {
  readonly target: RunTarget;
  /** The linked cloud repository's id, or null to pick one on send. */
  readonly cloudRepoId: string | null;
}

const INITIAL: RunTargetState = { target: "local", cloudRepoId: null };

let state: RunTargetState = INITIAL;
const listeners = new Set<() => void>();

const publish = (next: RunTargetState): void => {
  if (next.target === state.target && next.cloudRepoId === state.cloudRepoId) {
    return;
  }
  state = next;
  for (const listener of listeners) listener();
};

export const setRunTarget = (target: RunTarget): void =>
  publish({ ...state, target });

export const setCloudRepoId = (cloudRepoId: string | null): void =>
  publish({ ...state, cloudRepoId });

/** Tests only: back to a fresh window. */
export const resetRunTarget = (): void => publish(INITIAL);

export const useRunTarget = (): RunTargetState =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => INITIAL
  );
