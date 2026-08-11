/**
 * The project's tasks, re-read whenever one is dragged into another horizon,
 * changes status, or has its clock started — every surface that draws the
 * sequence has to agree about it the moment it moves.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  allTasks,
  subscribeToTasks,
  trackingNow,
  type MockTask,
} from "@/interactions/collaboration/data/collaboration.mock";

export function useTasks(): ReadonlyArray<MockTask> {
  return useSyncExternalStore(subscribeToTasks, allTasks, allTasks);
}

export interface LiveSpent {
  /** Banked minutes plus whatever the running clock has added. */
  minutes: number;
  running: boolean;
  /** Seconds on the current run, so a started clock visibly moves. */
  seconds: number;
}

export function useLiveSpent(task: MockTask): LiveSpent {
  const tracking = useSyncExternalStore(
    subscribeToTasks,
    trackingNow,
    trackingNow
  );
  const running = tracking?.taskId === task.id;
  const [, tick] = useState(0);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  if (!running || tracking === null) {
    return { minutes: task.spent, running: false, seconds: 0 };
  }
  const elapsed = Math.floor((Date.now() - tracking.startedAt) / 1000);
  return {
    minutes: task.spent + Math.floor(elapsed / 60),
    running: true,
    seconds: elapsed % 60,
  };
}
