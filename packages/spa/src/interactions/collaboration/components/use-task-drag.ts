/**
 * Dragging a task is the whole editing model: you do not set a rank, you put
 * the thing somewhere. A drop is a horizon plus a position, and the keyboard
 * does the same two moves so the sequence is not mouse-only.
 */
import { useState, type DragEvent } from "react";
import {
  moveTaskTo,
  SCOPES,
  scopeRank,
  type MockTask,
} from "@/interactions/collaboration/data/collaboration.mock";
import { announceMove } from "@/interactions/collaboration/components/announce-move";
import { laneTasks } from "@/interactions/collaboration/functions/task-flow.functions";

const slotKey = (scopeId: string, index: number) => `${scopeId}:${index}`;

export function useTaskDrag(tasks: ReadonlyArray<MockTask>) {
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const laneOf = (task: MockTask, scopeId: string) =>
    laneTasks(tasks, task.projectId, scopeId, task.parentId);

  /**
   * A slot counts the lane as it looks now, including the task being dragged,
   * so dropping below its own position has to account for the gap it leaves.
   */
  const drop = (scopeId: string, slot: number) => {
    const task = tasks.find((candidate) => candidate.id === dragging);
    setDragging(null);
    setOver(null);
    if (task === undefined) return;
    const from = laneOf(task, scopeId).findIndex(
      (candidate) => candidate.id === task.id
    );
    announceMove(
      moveTaskTo(task.id, scopeId, from >= 0 && from < slot ? slot - 1 : slot)
    );
  };

  const nudge = (task: MockTask, by: number) => {
    const lane = laneOf(task, task.scopeId);
    const at = lane.findIndex((candidate) => candidate.id === task.id);
    announceMove(moveTaskTo(task.id, task.scopeId, Math.max(0, at + by)));
  };

  const rescope = (task: MockTask, by: number) => {
    const next = SCOPES[scopeRank(task.scopeId) + by];
    if (next === undefined) return;
    announceMove(moveTaskTo(task.id, next.id, laneOf(task, next.id).length));
  };

  return {
    dragging,
    isActiveSlot: (scopeId: string, index: number) =>
      over === slotKey(scopeId, index),

    handleProps: (id: string) => ({
      draggable: true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
        setDragging(id);
      },
      onDragEnd: () => {
        setDragging(null);
        setOver(null);
      },
    }),

    slotProps: (scopeId: string, index: number) => ({
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (dragging === null) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setOver(slotKey(scopeId, index));
      },
      onDragLeave: () =>
        setOver((current) =>
          current === slotKey(scopeId, index) ? null : current
        ),
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        drop(scopeId, index);
      },
    }),

    /** Alt moves within the horizon, Alt+Shift moves between horizons. */
    keyProps: (task: MockTask) => ({
      onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
        if (!event.altKey) return;
        const by =
          event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
        if (by === 0) return;
        event.preventDefault();
        if (event.shiftKey) rescope(task, by);
        else nudge(task, by);
      },
    }),
  };
}
