import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSelection,
  focusAnnotation,
  followLatestPlan,
  openPlan,
  plansPaneSnapshot,
  selectNode,
} from "./plans-pane.store";

beforeEach(() => {
  // The store is module-scoped — one pane per window — so each test starts by
  // putting it back to nothing selected and following.
  openPlan("reset");
  openPlan(null);
});

describe("following the newest analysis", () => {
  it("opens the newest one when nothing is on screen", () => {
    followLatestPlan("plan-1");
    expect(plansPaneSnapshot().planId).toBe("plan-1");
  });

  /**
   * The reason the pane polls: an agent writes the analysis in another tab of
   * the same window, so nothing the reader does brings it in.
   */
  it("switches to an analysis that lands while the pane is open", () => {
    followLatestPlan("plan-1");
    followLatestPlan("plan-2");
    expect(plansPaneSnapshot().planId).toBe("plan-2");
  });

  it("stops following once the reader picks one themselves", () => {
    followLatestPlan("plan-1");
    openPlan("plan-older");
    followLatestPlan("plan-2");
    expect(plansPaneSnapshot().planId).toBe("plan-older");
  });

  it("follows again after the open analysis is cleared", () => {
    openPlan("plan-older");
    openPlan(null);
    followLatestPlan("plan-2");
    expect(plansPaneSnapshot().planId).toBe("plan-2");
  });

  it("leaves the reader's place alone when the newest is already open", () => {
    followLatestPlan("plan-1");
    selectNode("svc");
    followLatestPlan("plan-1");
    expect(plansPaneSnapshot().selectedNodeId).toBe("svc");
  });

  it("drops the previous plan's selection when it does switch", () => {
    followLatestPlan("plan-1");
    focusAnnotation("a1", "svc");
    followLatestPlan("plan-2");
    const pane = plansPaneSnapshot();
    expect(pane.selectedNodeId).toBeNull();
    expect(pane.selectedAnnotationId).toBeNull();
  });
});

describe("selection", () => {
  it("asks the graph to recentre only when the pick came from the notes", () => {
    followLatestPlan("plan-1");
    const before = plansPaneSnapshot().focusRequest;
    selectNode("svc");
    expect(plansPaneSnapshot().focusRequest).toBe(before);
    focusAnnotation("a1", "svc");
    expect(plansPaneSnapshot().focusRequest).toBeGreaterThan(before);
  });

  it("clears both halves of the selection at once", () => {
    followLatestPlan("plan-1");
    focusAnnotation("a1", "svc");
    clearSelection();
    const pane = plansPaneSnapshot();
    expect(pane.selectedNodeId).toBeNull();
    expect(pane.selectedAnnotationId).toBeNull();
  });
});
