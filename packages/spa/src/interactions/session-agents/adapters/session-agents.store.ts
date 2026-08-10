/**
 * The agents added by hand, held in a small localStorage-backed store.
 *
 * The detected CLIs come from the server; these do not exist anywhere but this
 * machine, so this is where they live until there is a server that runs them.
 */
import { useSyncExternalStore } from "react";
import type { CustomAgent } from "../interfaces/session-agents.interfaces";

const STORE_KEY = "byconvo-session-agents";

let sequence = 0;
export const nextAgentId = (): string => `agent-${(sequence += 1)}`;

const isAgent = (value: unknown): value is CustomAgent =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as CustomAgent).id === "string" &&
  typeof (value as CustomAgent).name === "string" &&
  typeof (value as CustomAgent).command === "string";

function load(): ReadonlyArray<CustomAgent> {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw === null) return [];
    const agents = (JSON.parse(raw) as ReadonlyArray<unknown>).filter(isAgent);
    // Restored ids must not collide with ones minted this session.
    sequence = agents.reduce(
      (highest, agent) => Math.max(highest, Number(agent.id.slice(6)) || 0),
      0
    );
    return agents;
  } catch {
    return [];
  }
}

let state: ReadonlyArray<CustomAgent> = load();
const listeners = new Set<() => void>();

export function updateCustomAgents(
  transition: (
    current: ReadonlyArray<CustomAgent>
  ) => ReadonlyArray<CustomAgent>
): void {
  const next = transition(state);
  if (next === state) return;
  state = next;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors
  }
  for (const listener of listeners) listener();
}

export const useCustomAgents = (): ReadonlyArray<CustomAgent> =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state
  );
