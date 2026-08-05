/**
 * The workspace's agents, re-read whenever one is added, paused or removed —
 * so the sidebar and the pane never disagree about who is running.
 */
import { useSyncExternalStore } from "react";
import {
  allAgents,
  subscribeToAgents,
  type MockAgent,
} from "@/interactions/collaboration/data/collaboration.mock";

export function useAgents(): ReadonlyArray<MockAgent> {
  return useSyncExternalStore(subscribeToAgents, allAgents, allAgents);
}
