import { describe, expect, it } from "vitest";
import {
  annotationTarget,
  annotationsForNode,
  buildAnalysisPrompt,
  buildAnalysisTitle,
  buildPlanReviewPrompt,
  buildPlanReviewTitle,
  planOutline,
  sameTarget,
  hasFileViewer,
  isBrokenAnchor,
  nodeStatus,
  nodeTarget,
  orderedAnnotations,
  resolutionFor,
  reviewAnnotations,
  stalenessMessage,
  statusLabel,
} from "./plans-pane.functions";
import type {
  Plan,
  PlanAnchor,
  PlanAnnotation,
  PlanNode,
  PlanStaleness,
} from "@byconvo/core/plans";
import type { AnnotationTarget } from "../interfaces/plans-pane.interfaces";

const anchor = (filePath: string, line: number | null): PlanAnchor => ({
  filePath,
  line,
  snippet: "return branch()",
  fileHash: "abc",
});

const node = (id: string, over: Partial<PlanNode> = {}): PlanNode => ({
  id,
  label: id,
  layer: "backend",
  kind: "service",
  summary: "",
  anchor: null,
  order: 0,
  ...over,
});

const annotation = (
  id: string,
  over: Partial<PlanAnnotation> = {}
): PlanAnnotation => ({
  id,
  origin: "analysis",
  nodeId: null,
  body: "a note",
  author: "claude",
  createdAt: "2026-01-01T00:00:00.000Z",
  anchor: null,
  ...over,
});

const plan = (over: Partial<Plan> = {}): Plan => ({
  id: "p1",
  title: "How a branch is created",
  question: "analyse how a new branch is created",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  savedAt: null,
  nodes: [],
  edges: [],
  annotations: [],
  ...over,
});

const staleness = (over: Partial<PlanStaleness> = {}): PlanStaleness => ({
  checkedAt: "2026-02-01T00:00:00.000Z",
  anchors: [],
  fresh: 0,
  relocated: 0,
  lost: 0,
  missing: 0,
  needsRerun: false,
  ...over,
});

describe("resolutionFor", () => {
  const report = staleness({
    anchors: [
      {
        target: "node",
        targetId: "n1",
        filePath: "a.ts",
        status: "fresh",
        line: 3,
        recordedLine: 3,
      },
      {
        target: "annotation",
        targetId: "n1",
        filePath: "b.ts",
        status: "lost",
        line: null,
        recordedLine: 9,
      },
    ],
  });

  it("does not confuse a node with a note that shares its id", () => {
    expect(resolutionFor(report, "node", "n1")?.filePath).toBe("a.ts");
    expect(resolutionFor(report, "annotation", "n1")?.filePath).toBe("b.ts");
  });

  it("is null when nothing was anchored", () => {
    expect(resolutionFor(report, "node", "nope")).toBeNull();
    expect(resolutionFor(undefined, "node", "n1")).toBeNull();
  });
});

describe("annotationTarget", () => {
  const note = annotation("a1", { anchor: anchor("src/branch.ts", 12) });

  it("is null for a note pinned to no code", () => {
    expect(annotationTarget(annotation("a1"), undefined)).toBeNull();
  });

  it("opens the line the code moved to, not the one recorded", () => {
    const target = annotationTarget(
      note,
      staleness({
        relocated: 1,
        anchors: [
          {
            target: "annotation",
            targetId: "a1",
            filePath: "src/branch.ts",
            status: "relocated",
            line: 40,
            recordedLine: 12,
          },
        ],
      })
    );
    expect(target).toEqual({
      filePath: "src/branch.ts",
      line: 40,
      status: "relocated",
    });
  });

  it("still offers the file when the line could not be found", () => {
    const target = annotationTarget(
      note,
      staleness({
        lost: 1,
        anchors: [
          {
            target: "annotation",
            targetId: "a1",
            filePath: "src/branch.ts",
            status: "lost",
            line: null,
            recordedLine: 12,
          },
        ],
      })
    );
    expect(target).toMatchObject({ filePath: "src/branch.ts", line: null });
    expect(isBrokenAnchor(target!.status)).toBe(true);
  });

  it("falls back to the recorded line before any check has run", () => {
    expect(annotationTarget(note, undefined)).toEqual({
      filePath: "src/branch.ts",
      line: 12,
      status: "fresh",
    });
  });
});

describe("nodeTarget", () => {
  const subject = plan({
    nodes: [node("svc", { anchor: anchor("src/branch.ts", 2) }), node("ui")],
  });

  it("points at the node's own file", () => {
    expect(nodeTarget(subject, "svc", undefined)).toMatchObject({
      filePath: "src/branch.ts",
      line: 2,
    });
  });

  it("is null for a node that stands for no file, or no node at all", () => {
    expect(nodeTarget(subject, "ui", undefined)).toBeNull();
    expect(nodeTarget(subject, "ghost", undefined)).toBeNull();
  });
});

describe("nodeStatus", () => {
  it("is null for a node with nothing to check", () => {
    expect(nodeStatus("ui", staleness())).toBeNull();
  });

  it("reports the status the check found", () => {
    expect(
      nodeStatus(
        "svc",
        staleness({
          anchors: [
            {
              target: "node",
              targetId: "svc",
              filePath: "a.ts",
              status: "missing",
              line: null,
              recordedLine: 1,
            },
          ],
        })
      )
    ).toBe("missing");
  });
});

describe("annotationsForNode", () => {
  const notes = [
    annotation("a1", { nodeId: "svc" }),
    annotation("a2", { nodeId: "ui" }),
    annotation("a3", { nodeId: null }),
  ];

  it("picks out the notes hanging off one node", () => {
    expect(annotationsForNode(notes, "svc").map((n) => n.id)).toEqual(["a1"]);
  });

  it("is empty when nothing is selected", () => {
    expect(annotationsForNode(notes, null)).toEqual([]);
  });
});

describe("orderedAnnotations", () => {
  it("reads down the flow, analysis note before the replies under it", () => {
    const ordered = orderedAnnotations(
      plan({
        nodes: [node("ui"), node("svc")],
        annotations: [
          annotation("loose", { nodeId: null }),
          annotation("svc-review", { nodeId: "svc", origin: "review" }),
          annotation("svc-analysis", { nodeId: "svc" }),
          annotation("ui-analysis", { nodeId: "ui" }),
        ],
      })
    );
    expect(ordered.map((entry) => entry.id)).toEqual([
      "ui-analysis",
      "svc-analysis",
      "svc-review",
      "loose",
    ]);
  });

  it("orders notes on one node by when they were written", () => {
    const ordered = orderedAnnotations(
      plan({
        nodes: [node("svc")],
        annotations: [
          annotation("later", {
            nodeId: "svc",
            origin: "review",
            createdAt: "2026-05-01T00:00:00.000Z",
          }),
          annotation("earlier", {
            nodeId: "svc",
            origin: "review",
            createdAt: "2026-03-01T00:00:00.000Z",
          }),
        ],
      })
    );
    expect(ordered.map((entry) => entry.id)).toEqual(["earlier", "later"]);
  });
});

describe("planOutline", () => {
  const outline = planOutline(
    plan({
      nodes: [
        node("ui", { label: "Button", kind: "ui", layer: "frontend" }),
        node("svc", { label: "createBranch", kind: "service" }),
        node("quiet", {
          label: "Nobody wrote about me",
          summary: "But it does something",
        }),
      ],
      annotations: [
        annotation("loose", { nodeId: null }),
        annotation("svc-mine", { nodeId: "svc", origin: "review" }),
        annotation("svc-found", { nodeId: "svc" }),
        annotation("ui-found", { nodeId: "ui" }),
      ],
    })
  );

  /**
   * The list is the drawing's index, so a step with nothing written about it
   * still gets a row — otherwise the two halves disagree about what exists.
   */
  it("has a row for every step, annotated or not", () => {
    expect(outline.map((group) => group.nodeId)).toEqual([
      "ui",
      "svc",
      "quiet",
      null,
    ]);
    expect(outline[2].annotations).toEqual([]);
  });

  it("reads down the flow, not in the order the nodes were declared", () => {
    // `ui` is in the frontend lane and the others in the backend one, so it
    // leads however the agent happened to write them out.
    const reversed = planOutline(
      plan({
        nodes: [
          node("svc", { layer: "backend" }),
          node("ui", { layer: "frontend" }),
        ],
      })
    );
    expect(reversed.map((group) => group.nodeId)).toEqual(["ui", "svc"]);
  });

  it("gathers a step's notes under it, findings before replies", () => {
    expect(outline[1].annotations.map((entry) => entry.id)).toEqual([
      "svc-found",
      "svc-mine",
    ]);
  });

  it("carries the step's label, kind and summary for the row", () => {
    expect(outline[0]).toMatchObject({ label: "Button", kind: "ui" });
    expect(outline[2].summary).toBe("But it does something");
  });

  it("puts the notes about the analysis itself last, with no step", () => {
    const last = outline[outline.length - 1];
    expect(last).toMatchObject({ nodeId: null, label: "", kind: null });
    expect(last.annotations.map((entry) => entry.id)).toEqual(["loose"]);
  });

  it("treats a note on a step that is not drawn as a loose note", () => {
    const orphaned = planOutline(
      plan({
        nodes: [node("ui")],
        annotations: [
          annotation("ghost-note", { nodeId: "deleted-step" }),
          annotation("ui-note", { nodeId: "ui" }),
        ],
      })
    );
    expect(orphaned.map((group) => group.nodeId)).toEqual(["ui", null]);
    expect(orphaned[1].annotations.map((entry) => entry.id)).toEqual([
      "ghost-note",
    ]);
  });

  it("has no trailing group when every note belongs to a step", () => {
    const tidy = planOutline(
      plan({
        nodes: [node("ui")],
        annotations: [annotation("ui-note", { nodeId: "ui" })],
      })
    );
    expect(tidy.map((group) => group.nodeId)).toEqual(["ui"]);
  });

  it("is empty for an analysis with no steps at all", () => {
    expect(planOutline(plan())).toEqual([]);
  });
});

describe("sameTarget", () => {
  const at = (filePath: string, line: number | null): AnnotationTarget => ({
    filePath,
    line,
    status: "fresh",
  });

  it("spots a note pointing at its own step's line", () => {
    expect(sameTarget(at("a.ts", 3), at("a.ts", 3))).toBe(true);
  });

  it("keeps a note that points somewhere else", () => {
    expect(sameTarget(at("a.ts", 3), at("a.ts", 9))).toBe(false);
    expect(sameTarget(at("a.ts", 3), at("b.ts", 3))).toBe(false);
  });

  it("is false when either side has no link", () => {
    expect(sameTarget(null, at("a.ts", 3))).toBe(false);
    expect(sameTarget(at("a.ts", 3), null)).toBe(false);
    expect(sameTarget(null, null)).toBe(false);
  });
});

describe("reviewAnnotations", () => {
  it("is only what the human added", () => {
    const notes = reviewAnnotations(
      plan({
        annotations: [annotation("a1"), annotation("a2", { origin: "review" })],
      })
    );
    expect(notes.map((entry) => entry.id)).toEqual(["a2"]);
  });
});

describe("stalenessMessage", () => {
  it("says nothing definite before a check has run", () => {
    expect(stalenessMessage(undefined)).toBeNull();
  });

  it("confirms an analysis that still lines up", () => {
    expect(stalenessMessage(staleness({ fresh: 4 }))?.tone).toBe("ok");
  });

  it("mentions a move without raising an alarm", () => {
    const message = stalenessMessage(staleness({ relocated: 2, fresh: 1 }));
    expect(message?.tone).toBe("moved");
    expect(message?.text).toContain("2 places");
  });

  it("asks for a rerun once code is gone, counting both ways of being gone", () => {
    const message = stalenessMessage(
      staleness({ lost: 1, missing: 2, relocated: 5, needsRerun: true })
    );
    expect(message?.tone).toBe("stale");
    expect(message?.text).toContain("3 anchors no longer match");
    expect(message?.text).toContain("rerun");
  });

  it("says anchor, singular, when there is one", () => {
    expect(stalenessMessage(staleness({ lost: 1 }))?.text).toContain(
      "1 anchor no longer matches"
    );
  });
});

describe("statusLabel", () => {
  it("explains every status a badge can wear", () => {
    expect(statusLabel("fresh")).toBe("Matches the code");
    expect(statusLabel("relocated")).toContain("moved");
    expect(statusLabel("lost")).toContain("rerun");
    expect(statusLabel("missing")).toContain("rerun");
  });
});

describe("hasFileViewer", () => {
  it("accepts the code pages that mount the viewer", () => {
    expect(hasFileViewer("/modes/code/commit")).toBe(true);
    expect(hasFileViewer("/modes/code/browse/commit/abc123")).toBe(true);
    expect(hasFileViewer("/modes/code/review/42")).toBe(true);
  });

  it("rejects the workspace pages that have nothing to show a file in", () => {
    expect(hasFileViewer("/modes/code/chats/c1")).toBe(false);
    expect(hasFileViewer("/modes/code/tasks")).toBe(false);
    expect(hasFileViewer("/modes/collaboration")).toBe(false);
    expect(hasFileViewer("/settings")).toBe(false);
  });

  it("is not fooled by a page whose name merely starts the same way", () => {
    expect(hasFileViewer("/modes/code/reviewers")).toBe(false);
  });
});

describe("buildAnalysisTitle", () => {
  it("capitalises the question and collapses its whitespace", () => {
    expect(
      buildAnalysisTitle("  analyse how a\n new branch  is created ")
    ).toBe("Analyse how a new branch is created");
  });

  it("clips a long question rather than letting it run", () => {
    const title = buildAnalysisTitle("x".repeat(200));
    expect(title).toHaveLength(61);
    expect(title.endsWith("…")).toBe(true);
  });

  it("has something to show for an empty question", () => {
    expect(buildAnalysisTitle("   ")).toBe("Analysis");
  });
});

describe("buildAnalysisPrompt", () => {
  it("carries the question and tells the agent where to put the result", () => {
    const prompt = buildAnalysisPrompt("  how is a branch created?  ");
    expect(prompt).toContain("how is a branch created?");
    expect(prompt).toContain("/api/plans");
    expect(prompt).toContain("anchor");
  });
});

describe("buildPlanReviewPrompt", () => {
  const prompt = buildPlanReviewPrompt(
    plan({ nodes: [node("svc", { label: "createBranch" })] }),
    [
      annotation("r1", {
        nodeId: "svc",
        origin: "review",
        body: "should this reject slashes?",
        anchor: anchor("src/branch.ts", 12),
      }),
      annotation("r2", { origin: "review", body: "the data lane is missing" }),
    ]
  );

  it("names the node a note was left on and where its code is", () => {
    expect(prompt).toContain('On "createBranch"');
    expect(prompt).toContain("src/branch.ts:12");
    expect(prompt).toContain("should this reject slashes?");
  });

  it("handles a note pinned to no node", () => {
    expect(prompt).toContain("On the analysis");
    expect(prompt).toContain("the data lane is missing");
  });

  it("titles the handoff by how many notes it carries", () => {
    expect(buildPlanReviewTitle(1)).toBe("Address 1 analysis note");
    expect(buildPlanReviewTitle(3)).toBe("Address 3 analysis notes");
  });
});
