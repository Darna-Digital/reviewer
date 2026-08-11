// @vitest-environment jsdom
/**
 * The two-way sync between the drawing and the notes, exercised through the
 * store the way the pane wires it — clicking a node is supposed to reveal its
 * notes, and clicking a note is supposed to select and recentre its node.
 *
 * The graph and the list never reference each other, so this is the only level
 * at which that contract exists to be checked.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan, PlanStaleness } from "@byconvo/core/plans";
import { PlanAnnotations } from "./plan-annotations";
import { PlanGraph } from "./plan-graph";
import {
  focusAnnotation,
  openPlan,
  plansPaneSnapshot,
  selectNode,
} from "../adapters/plans-pane.store";

const plan: Plan = {
  id: "p1",
  title: "How a branch is created",
  question: "analyse how a new branch is created",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  savedAt: null,
  nodes: [
    {
      id: "ui",
      label: "New branch button",
      layer: "frontend",
      kind: "ui",
      summary: "Opens the dialog",
      anchor: null,
      order: 0,
    },
    {
      id: "svc",
      label: "createBranch",
      layer: "backend",
      kind: "service",
      summary: "",
      anchor: {
        filePath: "src/branch.ts",
        line: 12,
        snippet: "assertValidRef(name)",
        fileHash: "abc",
      },
      order: 0,
    },
    {
      id: "quiet",
      label: "Nothing written about me",
      layer: "backend",
      kind: "store",
      summary: "But it does do something",
      anchor: null,
      order: 1,
    },
  ],
  edges: [
    { id: "e0", from: "ui", to: "svc", label: "POST /branches", kind: "call" },
  ],
  annotations: [
    {
      id: "a-svc",
      origin: "analysis",
      nodeId: "svc",
      body: "the ref name is validated here",
      author: "claude",
      createdAt: "2026-01-01T00:00:00.000Z",
      anchor: {
        filePath: "src/branch.ts",
        line: 12,
        snippet: "assertValidRef(name)",
        fileHash: "abc",
      },
    },
    {
      id: "a-mine",
      origin: "review",
      nodeId: "ui",
      body: "should this be disabled mid-rebase?",
      author: "you",
      createdAt: "2026-02-01T00:00:00.000Z",
      anchor: null,
    },
  ],
};

const relocated: PlanStaleness = {
  checkedAt: "2026-03-01T00:00:00.000Z",
  anchors: [
    {
      target: "annotation",
      targetId: "a-svc",
      filePath: "src/branch.ts",
      status: "relocated",
      line: 40,
      recordedLine: 12,
    },
    {
      target: "node",
      targetId: "svc",
      filePath: "src/branch.ts",
      status: "relocated",
      line: 40,
      recordedLine: 12,
    },
  ],
  fresh: 0,
  relocated: 2,
  lost: 0,
  missing: 0,
  needsRerun: false,
};

const lost: PlanStaleness = {
  ...relocated,
  anchors: relocated.anchors.map((entry) => ({
    ...entry,
    status: "lost" as const,
    line: null,
  })),
  relocated: 0,
  lost: 2,
  needsRerun: true,
};

/** The pane's own wiring of the two halves, minus the chrome around them. */
function Wired({
  staleness,
  onOpenCode = () => {},
}: {
  staleness?: PlanStaleness;
  onOpenCode?: (filePath: string, line: number | null) => void;
}) {
  const pane = plansPaneSnapshot();
  // A node's label shows in both halves — that is the point of the sync — so
  // the two are named here and every query below is scoped to one of them.
  return (
    <>
      <section aria-label="graph">
        <PlanGraph
          plan={plan}
          staleness={staleness}
          viewport={pane.viewport}
          selectedNodeId={pane.selectedNodeId}
          focusRequest={pane.focusRequest}
          onSelectNode={(nodeId) => nodeId !== null && selectNode(nodeId)}
          onOpenNode={() => {}}
        />
      </section>
      <section aria-label="notes">
        <PlanAnnotations
          plan={plan}
          staleness={staleness}
          selectedNodeId={pane.selectedNodeId}
          selectedAnnotationId={pane.selectedAnnotationId}
          onFocus={focusAnnotation}
          onOpenCode={onOpenCode}
          onRemove={() => {}}
        />
      </section>
    </>
  );
}

const graph = () => within(screen.getByLabelText("graph"));
const notes = () => within(screen.getByLabelText("notes"));
// A link prints its folders and its file in separate spans, so it is found by
// the name the two make together rather than by a single run of text.
const codeLink = (name: string) => notes().getByRole("button", { name });

beforeEach(() => {
  openPlan(null);
  openPlan("p1");
  // jsdom has no ResizeObserver, and the graph measures itself with one.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("the drawing and the notes", () => {
  it("draws every step and every note", () => {
    render(<Wired />);
    expect(graph().getByText("New branch button")).toBeDefined();
    expect(graph().getByText("createBranch")).toBeDefined();
    expect(graph().getByTitle("POST /branches").textContent).toBe(
      "POST /branches"
    );
    expect(notes().getByText("the ref name is validated here")).toBeDefined();
  });

  it("selects a node when its box is clicked", async () => {
    render(<Wired />);
    await userEvent.click(graph().getByText("createBranch"));
    expect(plansPaneSnapshot().selectedNodeId).toBe("svc");
  });

  it("selects the node behind a note, and asks the graph to recentre", async () => {
    render(<Wired />);
    const before = plansPaneSnapshot().focusRequest;
    await userEvent.click(notes().getByText("the ref name is validated here"));
    const after = plansPaneSnapshot();
    expect(after.selectedNodeId).toBe("svc");
    expect(after.selectedAnnotationId).toBe("a-svc");
    // The graph half recentres off this counter rather than off the selection,
    // so picking the same note twice moves the canvas twice.
    expect(after.focusRequest).toBeGreaterThan(before);
  });

  it("does not recentre when the pick was made on the graph itself", async () => {
    render(<Wired />);
    const before = plansPaneSnapshot().focusRequest;
    await userEvent.click(graph().getByText("createBranch"));
    expect(plansPaneSnapshot().focusRequest).toBe(before);
  });

  it("opens the line the code moved to, not the one recorded", async () => {
    const onOpenCode = vi.fn();
    render(<Wired staleness={relocated} onOpenCode={onOpenCode} />);
    await userEvent.click(codeLink("src/branch.ts:40"));
    expect(onOpenCode).toHaveBeenCalledWith("src/branch.ts", 40);
  });

  it("marks a note whose code is gone, and still offers the file", async () => {
    const onOpenCode = vi.fn();
    render(<Wired staleness={lost} onOpenCode={onOpenCode} />);
    const link = notes().getByTitle("This line is gone — rerun the analysis");
    expect(link.textContent).toContain("src/branch.ts");
    expect(link.textContent).not.toContain(":12");
    await userEvent.click(link);
    expect(onOpenCode).toHaveBeenCalledWith("src/branch.ts", null);
  });

  it("flags the step itself once its anchor is gone", () => {
    render(<Wired staleness={lost} />);
    expect(
      graph().getByTitle("This line is gone — rerun the analysis")
    ).toBeDefined();
  });

  it("tells the two kinds of note apart", () => {
    render(<Wired />);
    // The reader's note is signed; the analysis's own is not.
    expect(notes().getByText("you")).toBeDefined();
    expect(notes().queryByText("claude")).toBeNull();
  });

  it("only offers to remove the reader's own note", () => {
    render(<Wired />);
    expect(notes().getAllByLabelText("Remove note")).toHaveLength(1);
  });

  it("heads each note with the step it belongs to, once", () => {
    render(<Wired />);
    const rows = notes().getAllByRole("listitem");
    // The step's name appears at the head of its group rather than repeated on
    // every note under it.
    expect(rows[0].textContent).toContain("New branch button");
    expect(rows[1].textContent).toContain("createBranch");
  });

  /**
   * The list is the drawing's index. A step missing from it reads as a step
   * missing from the analysis, so every node gets a row whether or not anyone
   * has written about it.
   */
  it("lists every step of the flow, including the unannotated ones", () => {
    render(<Wired />);
    const rows = notes().getAllByRole("listitem");
    expect(rows).toHaveLength(plan.nodes.length);
    expect(rows[2].textContent).toContain("Nothing written about me");
    // A step with no notes still says what it does.
    expect(rows[2].textContent).toContain("But it does do something");
  });

  it("selects an unannotated step from its row", async () => {
    render(<Wired />);
    await userEvent.click(notes().getByText("Nothing written about me"));
    expect(plansPaneSnapshot().selectedNodeId).toBe("quiet");
  });

  it("selects the step from the summary line, not just the heading", async () => {
    render(<Wired />);
    await userEvent.click(notes().getByText("But it does do something"));
    expect(plansPaneSnapshot().selectedNodeId).toBe("quiet");
  });

  /**
   * The link does its own job and then lets the click carry on up to the row —
   * following code should light up the step it came from, not leave the drawing
   * pointing somewhere else.
   */
  it("both opens the file and selects the step from a code link", async () => {
    const onOpenCode = vi.fn();
    render(<Wired staleness={relocated} onOpenCode={onOpenCode} />);
    await userEvent.click(codeLink("src/branch.ts:40"));
    expect(onOpenCode).toHaveBeenCalledWith("src/branch.ts", 40);
    expect(plansPaneSnapshot().selectedNodeId).toBe("svc");
  });

  it("keeps a note's own selection when the note is clicked", async () => {
    render(<Wired />);
    await userEvent.click(
      notes().getByText("should this be disabled mid-rebase?")
    );
    // The row would otherwise overwrite this with the group's first note.
    expect(plansPaneSnapshot().selectedAnnotationId).toBe("a-mine");
    expect(plansPaneSnapshot().selectedNodeId).toBe("ui");
  });

  it("shows a step's own file once, not again under its note", () => {
    render(<Wired staleness={relocated} />);
    // The note is anchored to the same line as its step, so the link belongs at
    // the head of the group rather than on both.
    expect(
      notes().getAllByRole("button", { name: "src/branch.ts:40" })
    ).toHaveLength(1);
  });

  it("keeps a clipped edge label readable in full on hover", () => {
    render(<Wired />);
    // The drawn text is clipped to the lane gap; the chip's title carries the
    // whole of it, so nothing the analysis recorded is actually lost.
    const label = graph().getByTitle("POST /branches");
    expect(label.textContent).toMatch(/^POST/);
  });

  it("selects a step by its heading in the list", async () => {
    render(<Wired />);
    await userEvent.click(notes().getByText("createBranch"));
    expect(plansPaneSnapshot().selectedNodeId).toBe("svc");
  });

  /**
   * Agents write in markdown — identifiers in backticks, the odd emphasis — so a
   * note that shows its own source is a note nobody can read.
   */
  it("renders a note's markdown rather than its source", () => {
    const withMarkup: Plan = {
      ...plan,
      annotations: [
        { ...plan.annotations[0], body: "collapses to `[]` and **stops**" },
      ],
    };
    render(
      <PlanAnnotations
        plan={withMarkup}
        staleness={undefined}
        selectedNodeId={null}
        selectedAnnotationId={null}
        onFocus={() => {}}
        onOpenCode={() => {}}
        onRemove={() => {}}
      />
    );
    expect(screen.getByText("[]").tagName).toBe("CODE");
    expect(screen.getByText("stops").tagName).toBe("STRONG");
  });

  /**
   * A note that makes several points is written as a numbered list, which is what
   * the pane's own list styling is for — so it has to arrive as a real list and
   * not as a paragraph that happens to start with "1.".
   */
  it("renders a multi-point note as a numbered list", () => {
    const withList: Plan = {
      ...plan,
      annotations: [
        {
          ...plan.annotations[0],
          body: "1. Every failure collapses to nothing.\n2. Discovery never gates the turn.",
        },
      ],
    };
    render(
      <PlanAnnotations
        plan={withList}
        staleness={undefined}
        selectedNodeId={null}
        selectedAnnotationId={null}
        onFocus={() => {}}
        onOpenCode={() => {}}
        onRemove={() => {}}
      />
    );
    // The step rows are list items of their own, so the points are read off the
    // note's own list rather than off every `li` on screen.
    const list = screen
      .getByText("Every failure collapses to nothing.")
      .closest("ol");
    expect(list).not.toBeNull();
    expect(Array.from(list!.children, (item) => item.textContent)).toEqual([
      "Every failure collapses to nothing.",
      "Discovery never gates the turn.",
    ]);
  });
});
