import { describe, expect, it } from "vitest";
import {
  buildPlan,
  checkPlanStaleness,
  fingerprint,
  makeAnchor,
  normalizeGraph,
  planAnchorPaths,
  resolveAnchor,
  saveAnalysis,
  summarizePlan,
} from "./plans.functions.ts";
import type {
  Plan,
  PlanAnnotation,
  PlanEdge,
  PlanNode,
} from "../schema/plans.schema.ts";

const FILE = [
  "import x from 'x'",
  "",
  "export const create = () => {",
  "  return branch()",
  "}",
].join("\n");

const anchor = (line: number | null, content = FILE) =>
  makeAnchor("src/branch.ts", line, content);

const node = (over: Partial<PlanNode> = {}): PlanNode => ({
  id: "n1",
  label: "Create branch",
  layer: "backend",
  kind: "service",
  summary: "",
  anchor: null,
  order: 0,
  ...over,
});

const annotation = (over: Partial<PlanAnnotation> = {}): PlanAnnotation => ({
  id: "a1",
  origin: "analysis",
  nodeId: "n1",
  body: "the name is validated here",
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
  nodes: [node()],
  edges: [],
  annotations: [],
  ...over,
});

describe("fingerprint", () => {
  it("is stable for the same content and differs for a change", () => {
    expect(fingerprint(FILE)).toBe(fingerprint(FILE));
    expect(fingerprint(FILE)).not.toBe(fingerprint(`${FILE}\n`));
  });

  it("is not fooled by the same characters in another order", () => {
    expect(fingerprint("ab")).not.toBe(fingerprint("ba"));
  });
});

describe("makeAnchor", () => {
  it("records the anchored line's text, trimmed", () => {
    expect(anchor(4).snippet).toBe("return branch()");
  });

  it("carries no snippet when it anchors at the file as a whole", () => {
    expect(anchor(null).snippet).toBe("");
  });
});

describe("resolveAnchor", () => {
  it("takes an untouched file at its word", () => {
    expect(resolveAnchor(anchor(4), FILE)).toEqual({
      status: "fresh",
      line: 4,
    });
  });

  it("reports a deleted file as missing", () => {
    expect(resolveAnchor(anchor(4), null)).toEqual({
      status: "missing",
      line: null,
    });
  });

  it("follows the line down when code is inserted above it", () => {
    const moved = `// a new header\n// and another\n${FILE}`;
    expect(resolveAnchor(anchor(4), moved)).toEqual({
      status: "relocated",
      line: 6,
    });
  });

  it("follows the line up when code above it is deleted", () => {
    const moved = FILE.split("\n").slice(1).join("\n");
    expect(resolveAnchor(anchor(4), moved)).toEqual({
      status: "relocated",
      line: 3,
    });
  });

  it("gives up when the line itself is gone", () => {
    const rewritten = FILE.replace("  return branch()", "  return createRef()");
    expect(resolveAnchor(anchor(4), rewritten)).toEqual({
      status: "lost",
      line: null,
    });
  });

  it("picks the occurrence nearest where the line used to be", () => {
    const duplicated = [
      "  return branch()",
      "",
      ...FILE.split("\n"),
      "",
      "  return branch()",
    ].join("\n");
    // The original line 4 is now line 6; the decoys sit at 1 and 9.
    expect(resolveAnchor(anchor(4), duplicated)).toEqual({
      status: "relocated",
      line: 6,
    });
  });

  it("keeps a whole-file anchor once the file changes", () => {
    expect(resolveAnchor(anchor(null), `${FILE}\n// more`)).toEqual({
      status: "relocated",
      line: null,
    });
  });
});

describe("checkPlanStaleness", () => {
  const subject = plan({
    nodes: [node({ anchor: anchor(4) })],
    annotations: [annotation({ anchor: makeAnchor("src/api.ts", 1, "one") })],
  });

  it("passes a plan whose files are untouched", () => {
    const report = checkPlanStaleness(
      subject,
      new Map([
        ["src/branch.ts", FILE],
        ["src/api.ts", "one"],
      ]),
      "2026-02-01T00:00:00.000Z"
    );
    expect(report.fresh).toBe(2);
    expect(report.needsRerun).toBe(false);
  });

  it("asks for a rerun once an anchor points at code that is gone", () => {
    const report = checkPlanStaleness(
      subject,
      new Map<string, string | null>([
        ["src/branch.ts", FILE.replace("  return branch()", "  return ref()")],
        ["src/api.ts", "one"],
      ]),
      "2026-02-01T00:00:00.000Z"
    );
    expect(report.lost).toBe(1);
    expect(report.needsRerun).toBe(true);
    expect(report.anchors[0]).toMatchObject({
      target: "node",
      targetId: "n1",
      status: "lost",
      recordedLine: 4,
      line: null,
    });
  });

  it("does not call a file fresh just because it could not be read", () => {
    const report = checkPlanStaleness(
      subject,
      new Map(),
      "2026-02-01T00:00:00.000Z"
    );
    expect(report.missing).toBe(2);
    expect(report.needsRerun).toBe(true);
  });

  it("reports a move without asking for a rerun", () => {
    const report = checkPlanStaleness(
      subject,
      new Map([
        ["src/branch.ts", `// header\n${FILE}`],
        ["src/api.ts", "one"],
      ]),
      "2026-02-01T00:00:00.000Z"
    );
    expect(report.relocated).toBe(1);
    expect(report.needsRerun).toBe(false);
    expect(report.anchors[0]).toMatchObject({ status: "relocated", line: 5 });
  });
});

describe("planAnchorPaths", () => {
  it("lists each anchored file once", () => {
    const paths = planAnchorPaths(
      plan({
        nodes: [
          node({ id: "n1", anchor: anchor(4) }),
          node({ id: "n2", anchor: anchor(3) }),
        ],
        annotations: [
          annotation({ anchor: makeAnchor("src/api.ts", 1, "one") }),
        ],
      })
    );
    expect(paths).toEqual(["src/branch.ts", "src/api.ts"]);
  });
});

describe("saveAnalysis", () => {
  it("keeps the analysis's own notes and drops the review ones", () => {
    const saved = saveAnalysis(
      plan({
        annotations: [
          annotation({ id: "a1", origin: "analysis" }),
          annotation({ id: "a2", origin: "review" }),
        ],
      }),
      "2026-03-01T00:00:00.000Z"
    );
    expect(saved.annotations.map((entry) => entry.id)).toEqual(["a1"]);
    expect(saved.savedAt).toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("normalizeGraph", () => {
  const edge = (over: Partial<PlanEdge>): PlanEdge => ({
    id: "e0",
    from: "n1",
    to: "n2",
    label: "",
    kind: "call",
    ...over,
  });

  it("drops an edge whose ends are not both on the graph", () => {
    const result = normalizeGraph(
      [node({ id: "n1" }), node({ id: "n2" })],
      [edge({ id: "e0" }), edge({ id: "e1", to: "ghost" })]
    );
    expect(result.edges.map((entry) => entry.id)).toEqual(["e0"]);
  });

  it("collapses a repeated node id and drops self-edges", () => {
    const result = normalizeGraph(
      [node({ id: "n1", label: "first" }), node({ id: "n1", label: "again" })],
      [edge({ from: "n1", to: "n1" })]
    );
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].label).toBe("first");
    expect(result.edges).toEqual([]);
  });
});

describe("buildPlan", () => {
  const built = buildPlan({
    id: "p9",
    now: "2026-04-01T00:00:00.000Z",
    author: "claude",
    anchorFor: (value) =>
      value === null || value === undefined
        ? null
        : makeAnchor(value.filePath, value.line ?? null, FILE),
    annotationId: (index) => `a${index}`,
    input: {
      title: "How a branch is created",
      nodes: [
        { id: "ui", label: "Branch button", layer: "frontend" },
        {
          id: "svc",
          label: "createBranch",
          layer: "backend",
          kind: "service",
          anchor: { filePath: "src/branch.ts", line: 4 },
        },
      ],
      edges: [
        { from: "ui", to: "svc", label: "POST /branches" },
        { from: "ui", to: "nowhere" },
      ],
      annotations: [
        { nodeId: "svc", body: "validates the name" },
        { nodeId: "ghost", body: "orphaned" },
      ],
    },
  });

  it("fills the defaults an agent may leave out", () => {
    expect(built.nodes[0]).toMatchObject({
      kind: "service",
      summary: "",
      order: 0,
      anchor: null,
    });
    expect(built.edges[0]).toMatchObject({ kind: "call", id: "e0" });
    expect(built.savedAt).toBeNull();
  });

  it("keeps only the edges and annotations that land on a real node", () => {
    expect(built.edges).toHaveLength(1);
    expect(built.annotations[0].nodeId).toBe("svc");
    expect(built.annotations[1].nodeId).toBeNull();
  });

  it("marks everything the agent posted as the analysis's own", () => {
    expect(
      built.annotations.every((entry) => entry.origin === "analysis")
    ).toBe(true);
  });

  it("fingerprints the anchors it was given", () => {
    expect(built.nodes[1].anchor).toMatchObject({
      filePath: "src/branch.ts",
      line: 4,
      snippet: "return branch()",
    });
  });
});

describe("summarizePlan", () => {
  it("counts the graph without carrying it", () => {
    const summary = summarizePlan(
      plan({ nodes: [node(), node({ id: "n2" })], annotations: [annotation()] })
    );
    expect(summary).toMatchObject({ nodeCount: 2, annotationCount: 1 });
    expect(summary).not.toHaveProperty("nodes");
  });
});
