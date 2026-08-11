import { describe, expect, it } from "vitest";
import {
  centerOn,
  clampZoom,
  clearOfNodes,
  COLUMN_GAP,
  cubicMidpoint,
  fitLabel,
  fitViewport,
  groupByLane,
  LABEL_ROW,
  labelWidth,
  layoutPlanGraph,
  NODE_HEIGHT,
  NODE_WIDTH,
  panBy,
  PADDING,
  ROW_GAP,
  routeEdge,
  spreadLabels,
  zoomAt,
} from "./plan-graph.functions";
import type { PlanEdge, PlanNode } from "@byconvo/core/plans";
import type {
  PositionedNode,
  RoutedEdge,
} from "../interfaces/plans-pane.interfaces";

const node = (
  id: string,
  layer: PlanNode["layer"],
  over: Partial<PlanNode> = {}
): PlanNode => ({
  id,
  label: id,
  layer,
  kind: "service",
  summary: "",
  anchor: null,
  order: 0,
  ...over,
});

const edge = (from: string, to: string): PlanEdge => ({
  id: `${from}-${to}`,
  from,
  to,
  label: "",
  kind: "call",
});

const box = (x: number, y: number): PositionedNode => ({
  node: node("n", "frontend"),
  x,
  y,
  width: NODE_WIDTH,
  height: NODE_HEIGHT,
});

describe("groupByLane", () => {
  it("puts the lanes in flow order, whatever order the nodes arrived in", () => {
    const lanes = groupByLane([
      node("d", "data"),
      node("f", "frontend"),
      node("b", "backend"),
    ]);
    expect(lanes.map((lane) => lane.layer)).toEqual([
      "frontend",
      "backend",
      "data",
    ]);
  });

  it("leaves out a layer nothing is in", () => {
    const lanes = groupByLane([node("f", "frontend"), node("b", "backend")]);
    expect(lanes.map((lane) => lane.layer)).toEqual(["frontend", "backend"]);
  });

  it("sorts within a lane by order, falling back to declaration", () => {
    const lanes = groupByLane([
      node("second", "backend", { order: 5 }),
      node("first", "backend", { order: 1 }),
      node("tied-a", "backend", { order: 9 }),
      node("tied-b", "backend", { order: 9 }),
    ]);
    expect(lanes[0].nodes.map((entry) => entry.id)).toEqual([
      "first",
      "second",
      "tied-a",
      "tied-b",
    ]);
  });
});

describe("NODE_HEIGHT", () => {
  /**
   * The box is drawn in a `foreignObject` of exactly this height, so anything
   * taller is clipped rather than scrolled. It has to clear the tallest thing a
   * box can hold — pill, label, and a two-line summary — which is what went
   * wrong when the kind became a pill and the box stayed at its old height.
   */
  it("clears the tallest content a box can hold", () => {
    const padding = 16;
    const pill = 18;
    const gaps = 4 * 2;
    const label = 20;
    const summary = 16 * 2;
    expect(NODE_HEIGHT).toBeGreaterThanOrEqual(
      padding + pill + gaps + label + summary
    );
  });
});

describe("layoutPlanGraph", () => {
  const layout = layoutPlanGraph(
    [
      node("ui", "frontend"),
      node("api", "transport"),
      node("svc", "backend", { order: 0 }),
      node("repo", "backend", { order: 1 }),
    ],
    [edge("ui", "api"), edge("api", "svc"), edge("svc", "repo")]
  );

  const at = (id: string) =>
    layout.nodes.find((entry) => entry.node.id === id)!;

  it("runs the lanes left to right in flow order", () => {
    expect(at("ui").x).toBeLessThan(at("api").x);
    expect(at("api").x).toBeLessThan(at("svc").x);
  });

  it("gives every node in a lane the same column", () => {
    expect(at("svc").x).toBe(at("repo").x);
    expect(at("repo").y - at("svc").y).toBe(NODE_HEIGHT + ROW_GAP);
  });

  it("spaces the columns by the declared gap", () => {
    expect(at("api").x - at("ui").x).toBe(NODE_WIDTH + COLUMN_GAP);
  });

  it("centres a short lane against the tallest one", () => {
    // The backend lane holds two nodes, the frontend one; the single node sits
    // halfway down the taller lane rather than at its top.
    const backendMiddle = (at("svc").y + at("repo").y + NODE_HEIGHT) / 2;
    expect(at("ui").y + NODE_HEIGHT / 2).toBeCloseTo(backendMiddle, 5);
  });

  it("sizes the canvas to hold the drawing and its padding", () => {
    expect(layout.width).toBe(at("svc").x + NODE_WIDTH + PADDING);
    expect(layout.height).toBeGreaterThan(at("repo").y + NODE_HEIGHT);
  });

  it("names each lane it drew", () => {
    expect(layout.lanes.map((lane) => lane.label)).toEqual([
      "Frontend",
      "Transport",
      "Backend",
    ]);
  });

  it("routes every edge whose ends are on the graph", () => {
    expect(layout.edges).toHaveLength(3);
    expect(layout.edges[0].path.startsWith("M ")).toBe(true);
  });

  it("silently skips an edge pointing at a node that is not there", () => {
    const orphaned = layoutPlanGraph(
      [node("ui", "frontend")],
      [edge("ui", "ghost")]
    );
    expect(orphaned.edges).toEqual([]);
  });

  it("copes with an empty analysis", () => {
    const empty = layoutPlanGraph([], []);
    expect(empty.nodes).toEqual([]);
    expect(empty.width).toBe(PADDING);
  });

  /**
   * Two edges that cross between the same pair of lanes have their midpoints at
   * the *same* point — a forward curve's midpoint is the average of the two box
   * centres, and swapping which row goes to which averages to the same number.
   * So this is not a near miss the drawing gets away with: without the spread,
   * one label is printed exactly on top of the other.
   */
  it("does not stack the labels of two crossing edges", () => {
    const crossing = layoutPlanGraph(
      [
        node("ui", "frontend", { order: 0 }),
        node("state", "frontend", { order: 1 }),
        node("send", "transport", { order: 0 }),
        node("catalog", "transport", { order: 1 }),
      ],
      [
        { id: "e1", from: "ui", to: "catalog", label: "catalog", kind: "call" },
        {
          id: "e2",
          from: "state",
          to: "send",
          label: "first send",
          kind: "call",
        },
      ]
    );
    const [first, second] = crossing.edges;
    expect(Math.abs(first.label.y - second.label.y)).toBeGreaterThanOrEqual(14);
  });

  /**
   * The case from the drawing: `backend → external` flies over the data lane,
   * so the middle of its curve — where its label would otherwise sit — is
   * inside a box belonging to an entirely different step.
   */
  it("keeps the label of a lane-skipping edge off the box it flies over", () => {
    const skipping = layoutPlanGraph(
      [
        node("shell", "backend"),
        node("store", "data"),
        node("cli", "external"),
      ],
      [{ id: "e1", from: "shell", to: "cli", label: "claude -p", kind: "call" }]
    );
    const [routed] = skipping.edges;
    const flownOver = skipping.nodes.filter(
      (entry) => entry.node.id === "store"
    );
    const half = labelWidth(routed.labelText) / 2;
    for (const passed of flownOver) {
      const clear =
        routed.label.x + half <= passed.x ||
        routed.label.x - half >= passed.x + passed.width;
      expect(clear).toBe(true);
    }
  });
});

/** The `x y` the path ends on — where the arrowhead lands. */
const endsAt = (path: string): { x: number; y: number } => {
  const parts = path.trim().split(/[\s,]+/);
  return {
    x: Number(parts[parts.length - 2]),
    y: Number(parts[parts.length - 1]),
  };
};

/** The `x y` the path starts from. */
const startsAt = (path: string): { x: number; y: number } => {
  const parts = path.trim().split(/[\s,]+/);
  return { x: Number(parts[1]), y: Number(parts[2]) };
};

describe("routeEdge", () => {
  it("leaves the right face and enters the left one going forwards", () => {
    const { path } = routeEdge(box(0, 0), box(400, 0));
    expect(startsAt(path)).toEqual({ x: NODE_WIDTH, y: NODE_HEIGHT / 2 });
    expect(endsAt(path)).toEqual({ x: 400, y: NODE_HEIGHT / 2 });
  });

  /**
   * The case the first cut got wrong: handler → service → store sit in one
   * lane, and routing them as back-edges landed the arrowhead on the target's
   * *bottom* face, so every vertical step in the flow pointed backwards.
   */
  it("runs bottom face to top face going down a lane, so it points down", () => {
    const from = box(300, 0);
    const to = box(300, 200);
    const { path } = routeEdge(from, to);
    expect(startsAt(path)).toEqual({ x: 300 + NODE_WIDTH / 2, y: NODE_HEIGHT });
    // Arrives on the top edge of the lower box, not underneath it.
    expect(endsAt(path)).toEqual({ x: 300 + NODE_WIDTH / 2, y: 200 });
  });

  it("bows out to the side going back up a lane", () => {
    const { path } = routeEdge(box(300, 200), box(300, 0));
    const start = startsAt(path);
    const end = endsAt(path);
    // Right face to right face — a loop underneath would cut through the boxes
    // stacked between the two ends.
    expect(start).toEqual({ x: 300 + NODE_WIDTH, y: 200 + NODE_HEIGHT / 2 });
    expect(end).toEqual({ x: 300 + NODE_WIDTH, y: NODE_HEIGHT / 2 });
  });

  it("loops under the nodes when the edge runs back across lanes", () => {
    const { path, label } = routeEdge(box(400, 0), box(0, 0));
    expect(startsAt(path)).toEqual({ x: 400 + NODE_WIDTH / 2, y: NODE_HEIGHT });
    expect(endsAt(path)).toEqual({ x: NODE_WIDTH / 2, y: NODE_HEIGHT });
    expect(label.y).toBeGreaterThan(NODE_HEIGHT);
  });

  it("puts the label on the curve rather than between the boxes", () => {
    const { label, labelAnchor } = routeEdge(box(0, 0), box(400, 200));
    const straightMiddle = (NODE_HEIGHT / 2 + 200 + NODE_HEIGHT / 2) / 2;
    expect(label.y).toBeCloseTo(straightMiddle, 5);
    expect(label.x).toBeGreaterThan(NODE_WIDTH);
    expect(label.x).toBeLessThan(400);
    expect(labelAnchor).toBe("middle");
  });

  it("sets a same-lane label beside the line, clear of the boxes", () => {
    const { label, labelAnchor } = routeEdge(box(300, 0), box(300, 200));
    // Two stacked boxes leave only a row gap between them, so a centred label
    // would sit on top of one of them.
    expect(label.x).toBeGreaterThanOrEqual(300 + NODE_WIDTH);
    expect(labelAnchor).toBe("start");
  });
});

/** The room a label actually has between two lanes. */
const GUTTER = COLUMN_GAP - 16;

describe("fitLabel", () => {
  it("leaves a label that already fits alone", () => {
    expect(fitLabel("dispatch", 200)).toBe("dispatch");
  });

  it("clips a label wider than the room it has", () => {
    // The case from the drawing: a long path label centred in a lane gap ran
    // over the boxes on both sides of it.
    const fitted = fitLabel("POST /api/chats/{id}/messages", COLUMN_GAP - 16);
    expect(fitted.length).toBeLessThan("POST /api/chats/{id}/messages".length);
    expect(fitted.endsWith("…")).toBe(true);
  });

  it("does not leave a separator stranded before the ellipsis", () => {
    expect(fitLabel("one two three four", 40)).not.toContain(" …");
    expect(fitLabel("stdout NDJSON -> delta event", GUTTER)).not.toContain(
      "->…"
    );
  });

  /**
   * The labels are rendered as their author wrote them, so the only lever on how
   * they read is where the ellipsis falls. Mid-token reads as damage; at a
   * separator it reads as an abbreviation.
   */
  it("cuts at a token boundary rather than mid-word", () => {
    expect(fitLabel("startChatTurn(repoPath, id, text, images)", GUTTER)).toBe(
      "startChatTurn…"
    );
    expect(fitLabel("POST /api/chats/{id}/messages", GUTTER)).toBe(
      "POST /api/chats…"
    );
    expect(fitLabel("applyChatEvent appends text", GUTTER)).toBe(
      "applyChatEvent…"
    );
    expect(fitLabel("{event: delta} broadcast", GUTTER)).toBe(
      "{event: delta}…"
    );
  });

  it("cuts mid-token rather than lose most of the line to one", () => {
    // The only boundary is right at the start, so honouring it would leave
    // almost nothing — the hard cut keeps more of the label.
    expect(fitLabel("a/verylongsingletokenindeed", 60)).toBe("a/verylong…");
  });

  it("always keeps a few characters, however little room there is", () => {
    expect(fitLabel("something long", 0).length).toBeGreaterThan(1);
  });
});

describe("edge labels", () => {
  const labelled = (from: PositionedNode, to: PositionedNode, text: string) =>
    routeEdge(from, to, text).labelText;

  it("fits a label to the lane gap it sits in", () => {
    const long = "POST /api/chats/{id}/messages";
    expect(labelled(box(0, 0), box(400, 0), long)).not.toBe(long);
    expect(labelled(box(0, 0), box(400, 0), "send")).toBe("send");
  });

  it("gives a back-edge the whole span it loops under", () => {
    // It runs below every box, so it is not squeezed into a lane gap.
    const text = "chat.updated (streamed)";
    expect(labelled(box(900, 0), box(0, 0), text)).toBe(text);
  });

  it("is empty when the edge carries no label", () => {
    expect(labelled(box(0, 0), box(400, 0), "")).toBe("");
  });
});

/** A routed edge standing at a point, with a flat curve through it. */
const at = (id: string, x: number, y: number, text: string): RoutedEdge => ({
  edge: { id, from: "a", to: "b", label: text, kind: "call" },
  path: "",
  curve: {
    from: { x: x - 100, y },
    c1: { x: x - 50, y },
    c2: { x: x + 50, y },
    to: { x: x + 100, y },
  },
  label: { x, y },
  labelAnchor: "middle",
  labelText: text,
});

describe("spreadLabels", () => {
  /** The same measure the spread uses, so a test failure is a real overlap. */
  const overlapping = (edges: ReadonlyArray<RoutedEdge>) => {
    const drawn = edges.filter((entry) => entry.labelText !== "");
    const pairs: Array<[string, string]> = [];
    for (const a of drawn) {
      for (const b of drawn) {
        if (a.edge.id >= b.edge.id) continue;
        const halfA = (a.labelText.length * 5.2) / 2;
        const halfB = (b.labelText.length * 5.2) / 2;
        const apart =
          Math.abs(a.label.x - b.label.x) >= halfA + halfB ||
          Math.abs(a.label.y - b.label.y) >= 14;
        if (!apart) pairs.push([a.edge.id, b.edge.id]);
      }
    }
    return pairs;
  };

  it("pulls two labels off each other", () => {
    const spread = spreadLabels([
      at("e1", 100, 200, "first send"),
      at("e2", 104, 203, "catalog"),
    ]);
    expect(overlapping(spread)).toEqual([]);
  });

  it("keeps the pair where the pair was", () => {
    const before = [
      at("e1", 100, 200, "first send"),
      at("e2", 104, 203, "catalog"),
    ];
    const middle = (edges: ReadonlyArray<RoutedEdge>) =>
      edges.reduce((sum, entry) => sum + entry.label.y, 0) / edges.length;
    // Dealt out around where they already were, rather than pushed downwards
    // off the curves they belong to.
    expect(middle(spreadLabels(before))).toBeCloseTo(middle(before));
  });

  it("leaves a label that collides with nothing exactly where it is", () => {
    const alone = at("e1", 100, 200, "send");
    const spread = spreadLabels([alone, at("e2", 600, 40, "read")]);
    expect(spread[0].label).toEqual(alone.label);
  });

  it("separates a chain of labels that only overlap their neighbours", () => {
    const spread = spreadLabels([
      at("e1", 100, 200, "one"),
      at("e2", 104, 206, "two"),
      at("e3", 108, 212, "three"),
      at("e4", 112, 218, "four"),
    ]);
    expect(overlapping(spread)).toEqual([]);
  });

  it("does not move a label sideways", () => {
    const before = [at("e1", 100, 200, "first"), at("e2", 104, 203, "second")];
    expect(spreadLabels(before).map((entry) => entry.label.x)).toEqual([
      100, 104,
    ]);
  });

  it("ignores the edges that draw no label at all", () => {
    const blank = [at("e1", 100, 200, ""), at("e2", 100, 200, "")];
    expect(spreadLabels(blank)).toEqual(blank);
  });

  /**
   * Dealt out at exactly a chip's height the two chips touch, and a reader
   * takes them for one label wrapped onto a second line.
   */
  it("leaves clear air between two labels it stacked", () => {
    const [first, second] = spreadLabels([
      at("e1", 100, 200, "first send"),
      at("e2", 104, 203, "catalog"),
    ]);
    expect(Math.abs(first.label.y - second.label.y)).toBeGreaterThan(LABEL_ROW);
  });
});

describe("clearOfNodes", () => {
  const flat: RoutedEdge = {
    edge: { id: "e1", from: "a", to: "b", label: "claude -p", kind: "call" },
    path: "",
    curve: {
      from: { x: 0, y: 100 },
      c1: { x: 266, y: 100 },
      c2: { x: 533, y: 100 },
      to: { x: 800, y: 100 },
    },
    label: { x: 400, y: 100 },
    labelAnchor: "middle",
    labelText: "claude -p",
  };

  const boxAt = (x: number): PositionedNode => ({
    node: node("mid", "transport"),
    x,
    y: 60,
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
  });

  it("slides a label along its curve out from under a box", () => {
    const [moved] = clearOfNodes([flat], [boxAt(340)]);
    const half = labelWidth(moved.labelText) / 2;
    expect(
      moved.label.x + half <= 340 || moved.label.x - half >= 340 + NODE_WIDTH
    ).toBe(true);
    // Along the line it names, not off it.
    expect(moved.label.y).toBeCloseTo(100, 5);
  });

  it("leaves a label that is already in clear air", () => {
    expect(clearOfNodes([flat], [boxAt(700)])[0].label).toEqual(flat.label);
  });

  it("does not move a label the routing already set beside its line", () => {
    const beside: RoutedEdge = { ...flat, labelAnchor: "start" };
    expect(clearOfNodes([beside], [boxAt(340)])[0].label).toEqual(beside.label);
  });
});

describe("cubicMidpoint", () => {
  it("is the curve at t=0.5, not the chord's centre", () => {
    const mid = cubicMidpoint(
      { x: 0, y: 0 },
      { x: 0, y: 100 },
      { x: 100, y: 100 },
      { x: 100, y: 0 }
    );
    expect(mid).toEqual({ x: 50, y: 75 });
  });
});

describe("fitViewport", () => {
  const layout = layoutPlanGraph(
    [node("ui", "frontend"), node("svc", "backend")],
    []
  );

  it("shrinks a wide graph to fit and centres it", () => {
    const view = fitViewport(layout, { width: 300, height: 600 });
    expect(view.zoom).toBeCloseTo(300 / layout.width, 5);
    expect(view.x).toBeCloseTo(0, 5);
  });

  it("never magnifies a small graph past its own size", () => {
    const view = fitViewport(layout, { width: 4000, height: 4000 });
    expect(view.zoom).toBe(1);
  });

  it("stays put rather than dividing by an unmeasured pane", () => {
    expect(fitViewport(layout, { width: 0, height: 0 })).toEqual({
      zoom: 1,
      x: 0,
      y: 0,
    });
  });
});

describe("centerOn", () => {
  it("puts the node's middle in the pane's middle", () => {
    const view = centerOn(box(500, 300), { width: 400, height: 400 }, 1);
    expect(view.x + 500 + NODE_WIDTH / 2).toBe(200);
    expect(view.y + 300 + NODE_HEIGHT / 2).toBe(200);
  });

  it("keeps the zoom it was given", () => {
    expect(centerOn(box(0, 0), { width: 400, height: 400 }, 0.5).zoom).toBe(
      0.5
    );
  });
});

describe("zoomAt", () => {
  it("keeps the point under the cursor where it was", () => {
    const before = { zoom: 1, x: 0, y: 0 };
    const cursor = { x: 120, y: 80 };
    const after = zoomAt(before, 2, cursor);
    const graphPoint = {
      x: (cursor.x - before.x) / before.zoom,
      y: (cursor.y - before.y) / before.zoom,
    };
    expect(after.x + graphPoint.x * after.zoom).toBeCloseTo(cursor.x, 5);
    expect(after.y + graphPoint.y * after.zoom).toBeCloseTo(cursor.y, 5);
  });

  it("refuses to zoom past its limits", () => {
    expect(zoomAt({ zoom: 1, x: 0, y: 0 }, 100, { x: 0, y: 0 }).zoom).toBe(2);
    expect(clampZoom(0.01)).toBe(0.25);
  });
});

describe("panBy", () => {
  it("moves the drawing without changing the zoom", () => {
    expect(panBy({ zoom: 0.5, x: 10, y: 20 }, 5, -5)).toEqual({
      zoom: 0.5,
      x: 15,
      y: 15,
    });
  });
});
