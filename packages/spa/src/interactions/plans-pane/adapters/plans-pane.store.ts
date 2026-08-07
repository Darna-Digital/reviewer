/**
 * What the plans pane is looking at, in the same shape as the browser pane's
 * store.
 *
 * The selection lives here rather than in either half of the pane because both
 * halves write it and both read it: that single shared field is what makes
 * clicking a note highlight its node and clicking a node reveal its notes, with
 * neither side needing to know the other exists.
 *
 * None of it is persisted — which plan was open is a UI preference, while the
 * selection and the viewport are only true of the pane that is mounted now.
 */
import { useSyncExternalStore } from "react";
import { IDENTITY_VIEWPORT } from "../functions/plan-graph.functions";
import type {
  PlansPaneState,
  Viewport,
} from "../interfaces/plans-pane.interfaces";

const initial: PlansPaneState = {
  planId: null,
  followLatest: true,
  selectedNodeId: null,
  selectedAnnotationId: null,
  viewport: IDENTITY_VIEWPORT,
  focusRequest: 0,
};

let state: PlansPaneState = initial;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const set = (next: PlansPaneState) => {
  state = next;
  emit();
};

export const plansPaneSnapshot = (): PlansPaneState => state;

/**
 * Show a plan because the reader asked for it, dropping any selection that
 * belonged to the previous one.
 *
 * Picking one by hand also stops the pane following whatever is newest — having
 * chosen an analysis to read, having it swapped out from under you the moment an
 * agent finishes another one would be worse than missing the new one.
 * Clearing the selection entirely (after a delete) starts following again.
 */
export const openPlan = (planId: string | null): void => {
  if (state.planId === planId) return;
  set({
    ...initial,
    planId,
    followLatest: planId === null,
    focusRequest: state.focusRequest,
  });
};

/**
 * Show the most recently touched plan because it has just arrived — an agent
 * finishing an analysis is the whole reason the pane polls.
 */
export const followLatestPlan = (planId: string): void => {
  if (state.planId === planId || !state.followLatest) return;
  set({ ...initial, planId, focusRequest: state.focusRequest });
};

/**
 * A pick made on the graph. It does not bump `focusRequest`: the node is already
 * under the pointer, and recentring the canvas out from under a click is the
 * one thing that would make the drawing feel like it is fighting back.
 */
export const selectNode = (nodeId: string | null): void => {
  set({ ...state, selectedNodeId: nodeId, selectedAnnotationId: null });
};

/**
 * A pick made in the notes list — the other direction of the sync. This one does
 * ask the graph to recentre, since the node may well be off screen.
 */
export const focusAnnotation = (
  annotationId: string | null,
  nodeId: string | null
): void => {
  set({
    ...state,
    selectedAnnotationId: annotationId,
    selectedNodeId: nodeId,
    focusRequest: state.focusRequest + 1,
  });
};

export const setViewport = (viewport: Viewport): void => {
  if (
    state.viewport.zoom === viewport.zoom &&
    state.viewport.x === viewport.x &&
    state.viewport.y === viewport.y
  ) {
    return;
  }
  set({ ...state, viewport });
};

export const clearSelection = (): void => {
  if (state.selectedNodeId === null && state.selectedAnnotationId === null) {
    return;
  }
  set({ ...state, selectedNodeId: null, selectedAnnotationId: null });
};

export const usePlansPane = (): PlansPaneState =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state
  );
