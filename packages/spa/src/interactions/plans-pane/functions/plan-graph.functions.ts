/**
 * Laying an analysis out.
 *
 * The graph is a flow, not a free-form diagram: every node declares the layer it
 * belongs to, the layers have a fixed order, and that order is the horizontal
 * one. So "frontend on the left, backend on the right" needs no force
 * simulation and no layout library — it is a grouped sort, which is also why the
 * result is stable between renders and assertable in a test.
 */
import { PLAN_LAYERS } from "@reviewer/core/plans";
import type { PlanEdge, PlanLayer, PlanNode } from "@reviewer/core/plans";
import type {
  Curve,
  GraphLayout,
  LabelAnchor,
  LaneBox,
  Point,
  PositionedNode,
  RoutedEdge,
  Size,
  Viewport,
} from "../interfaces/plans-pane.interfaces";

export const NODE_WIDTH = 208;
/**
 * Tall enough for everything a box can hold: the kind pill, a line of label,
 * and two lines of summary, plus its own padding.
 *
 * The box is drawn inside a `foreignObject` of exactly this height, which clips
 * whatever does not fit — so this is not a suggestion. It is stated as the sum
 * it has to cover, and the leading of each part is pinned in the component
 * rather than inherited, so the arithmetic stays true.
 */
export const NODE_HEIGHT =
  16 + // py-2
  18 + // kind pill
  4 + // gap-1
  20 + // label, leading-5
  4 + // gap-1
  32 + // summary, two lines at leading-4
  2; // a hair of slack for descenders
/** Wide enough for an edge label to sit between two lanes without crowding. */
export const COLUMN_GAP = 128;
export const ROW_GAP = 28;
export const PADDING = 48;

/**
 * Roughly one character's width at the label's own font size (`0.625rem`).
 *
 * An approximation is the right tool here: the alternative is measuring text in
 * the DOM, which would drag layout — the one part of this feature that is pure
 * and testable — into needing a rendered document.
 */
const LABEL_CHAR_WIDTH = 5.2;

/**
 * Where a label may be cut: the punctuation that separates one part of a call,
 * path or phrase from the next.
 */
const TOKEN_BOUNDARY = /[\s/(.,:>-]/;
/** Trailing separators look like a typo in front of an ellipsis. */
const TRAILING_BOUNDARY = /[\s/(.,:>-]+$/;
/**
 * How much of the budget a boundary has to leave in place to be worth cutting
 * at. Below this the label loses more than the tidiness is worth.
 */
const BOUNDARY_KEEP = 0.6;

/**
 * A label clipped to the room it actually has, cut at a token boundary.
 *
 * The text itself is never rewritten — a label says what its author wrote — but
 * *where* it breaks is the renderer's business, and a break mid-token is what
 * makes a perfectly good label look careless: `startChatTurn(repoPa…` reads as
 * damage, `startChatTurn…` reads as an abbreviation. So the cut falls back to
 * the last separator, unless that would throw away most of the line.
 *
 * The whole text stays on the element, so nothing is lost, only deferred to a
 * hover.
 */
export const fitLabel = (text: string, available: number): string => {
  const capacity = Math.max(6, Math.floor(available / LABEL_CHAR_WIDTH));
  if (text.length <= capacity) return text;

  const budget = capacity - 1;
  const head = text.slice(0, budget);
  let boundary = -1;
  for (let index = head.length - 1; index > 0; index -= 1) {
    if (TOKEN_BOUNDARY.test(head[index])) {
      boundary = index;
      break;
    }
  }
  const kept =
    boundary >= Math.floor(budget * BOUNDARY_KEEP)
      ? head.slice(0, boundary)
      : head;
  return `${kept.replace(TRAILING_BOUNDARY, "")}…`;
};

/** The room an edge label has between two lanes, minus a little breathing space. */
const GUTTER_ROOM = COLUMN_GAP - 16;

const LANE_LABELS: Readonly<Record<PlanLayer, string>> = {
  entry: "Entry",
  frontend: "Frontend",
  transport: "Transport",
  backend: "Backend",
  data: "Data",
  external: "External",
};

export const laneLabel = (layer: PlanLayer): string => LANE_LABELS[layer];

const layerRank = (layer: PlanLayer): number => PLAN_LAYERS.indexOf(layer);

/** Nodes grouped into their lanes, lanes in flow order, empty ones dropped. */
export const groupByLane = (
  nodes: ReadonlyArray<PlanNode>
): ReadonlyArray<{ layer: PlanLayer; nodes: ReadonlyArray<PlanNode> }> => {
  const byLayer = new Map<PlanLayer, Array<{ node: PlanNode; at: number }>>();
  nodes.forEach((node, at) => {
    const bucket = byLayer.get(node.layer);
    if (bucket === undefined) byLayer.set(node.layer, [{ node, at }]);
    else bucket.push({ node, at });
  });
  return [...byLayer.entries()]
    .sort(([a], [b]) => layerRank(a) - layerRank(b))
    .map(([layer, entries]) => ({
      layer,
      // `order` is the agent's intent; the declaration index only breaks ties,
      // so two nodes it did not rank keep the order it wrote them in.
      nodes: entries
        .sort((a, b) => a.node.order - b.node.order || a.at - b.at)
        .map((entry) => entry.node),
    }));
};

const cubic = ({ from, c1, c2, to }: Curve): string =>
  `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`;

/** A point on the curve itself — which is where a label belongs, not beside it. */
export const cubicAt = ({ from, c1, c2, to }: Curve, t: number): Point => {
  const u = 1 - t;
  const w0 = u * u * u;
  const w1 = 3 * u * u * t;
  const w2 = 3 * u * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * from.x + w1 * c1.x + w2 * c2.x + w3 * to.x,
    y: w0 * from.y + w1 * c1.y + w2 * c2.y + w3 * to.y,
  };
};

export const cubicMidpoint = (
  from: Point,
  c1: Point,
  c2: Point,
  to: Point
): Point => cubicAt({ from, c1, c2, to }, 0.5);

/** How far a same-lane label sits clear of the boxes, into the gutter. */
const GUTTER_OFFSET = 12;

/**
 * The curve between two boxes. Three cases, because an arrowhead has to land on
 * the face the flow actually enters — a step that arrives from above must not
 * be drawn arriving from below.
 *
 * - **Across lanes, forwards**: right face to left face, control points pushed
 *   out horizontally so it departs and arrives flat.
 * - **Down a lane**: bottom face to top face. The common case for
 *   handler → service → store, and the one that has to point downwards.
 * - **Backwards** — a callback, a write that feeds the UI again: it cannot take
 *   a direct line without crossing its own nodes, so it leaves the bottom face
 *   and loops under, which also makes "this one goes back" readable at a glance.
 *   Within a single lane it bows out to the side instead, since a loop under
 *   would run straight through the boxes between its ends.
 */
export const routeEdge = (
  from: PositionedNode,
  to: PositionedNode,
  text = ""
): {
  path: string;
  curve: Curve;
  label: Point;
  labelAnchor: LabelAnchor;
  labelText: string;
} => {
  if (to.x > from.x) {
    const start = { x: from.x + from.width, y: from.y + from.height / 2 };
    const end = { x: to.x, y: to.y + to.height / 2 };
    const reach = Math.max(48, (end.x - start.x) / 2);
    const curve = {
      from: start,
      c1: { x: start.x + reach, y: start.y },
      c2: { x: end.x - reach, y: end.y },
      to: end,
    };
    return {
      path: cubic(curve),
      curve,
      label: cubicAt(curve, 0.5),
      labelAnchor: "middle",
      labelText: fitLabel(text, GUTTER_ROOM),
    };
  }

  const sameLane = to.x === from.x;
  if (sameLane && to.y > from.y) {
    const start = { x: from.x + from.width / 2, y: from.y + from.height };
    const end = { x: to.x + to.width / 2, y: to.y };
    const reach = Math.max(12, (end.y - start.y) / 2);
    const curve = {
      from: start,
      c1: { x: start.x, y: start.y + reach },
      c2: { x: end.x, y: end.y - reach },
      to: end,
    };
    return {
      path: cubic(curve),
      curve,
      // The run between two stacked boxes is only a row gap tall, so a label
      // centred on it would sit on the boxes. It goes beside the line instead,
      // in the gutter the lanes already leave free.
      label: {
        x: from.x + from.width + GUTTER_OFFSET,
        y: cubicAt(curve, 0.5).y,
      },
      labelAnchor: "start",
      labelText: fitLabel(text, GUTTER_ROOM - GUTTER_OFFSET),
    };
  }

  if (sameLane) {
    const start = { x: from.x + from.width, y: from.y + from.height / 2 };
    const end = { x: to.x + to.width, y: to.y + to.height / 2 };
    const bow = 44;
    const curve = {
      from: start,
      c1: { x: start.x + bow, y: start.y },
      c2: { x: end.x + bow, y: end.y },
      to: end,
    };
    return {
      path: cubic(curve),
      curve,
      label: cubicAt(curve, 0.5),
      labelAnchor: "start",
      labelText: fitLabel(text, GUTTER_ROOM),
    };
  }

  const start = { x: from.x + from.width / 2, y: from.y + from.height };
  const end = { x: to.x + to.width / 2, y: to.y + to.height };
  const drop = Math.max(56, Math.abs(start.x - end.x) / 3);
  const curve = {
    from: start,
    c1: { x: start.x, y: start.y + drop },
    c2: { x: end.x, y: end.y + drop },
    to: end,
  };
  return {
    path: cubic(curve),
    curve,
    label: cubicAt(curve, 0.5),
    labelAnchor: "middle",
    // The loop runs below every box, so the label has the whole span it crosses.
    labelText: fitLabel(text, Math.abs(end.x - start.x)),
  };
};

/** The padding the drawn chip puts either side of a label's text. */
const LABEL_PADDING_X = 4;

/** How wide a label is drawn, chip and all — an estimate, as in `fitLabel`. */
export const labelWidth = (text: string): number =>
  text.length * LABEL_CHAR_WIDTH + LABEL_PADDING_X * 2;

/**
 * The room one label needs vertically: the chip is a `0.625rem` line in its own
 * padding, and the couple of pixels over that are what keep two of them from
 * meeting edge to edge.
 */
export const LABEL_ROW = 16;

/**
 * The clear air between two labels that had to be dealt out into rows. Stacked
 * at a bare row apart they touch, and two chips touching read as one label
 * wrapped onto a second line — the reader cannot tell that `stars + rail` and
 * `initial model` are two edges. The gap is what says they are separate.
 */
export const LABEL_GAP = 10;

/** Row to row, for labels moved off each other. */
export const LABEL_PITCH = LABEL_ROW + LABEL_GAP;

/**
 * The box the chip is laid out inside. Deliberately wider than any label — the
 * chip sizes itself to its text, so nothing here has to be right, only roomy —
 * and it takes no pointer, so the slack around the chip is still canvas.
 */
export const LABEL_BOX_WIDTH = 240;
export const LABEL_BOX_HEIGHT = LABEL_ROW;

/**
 * Where a label actually lands, which its anchor decides as much as its point.
 * Measured at the full pitch rather than the chip's own height, so two labels
 * count as colliding while they are merely too close to tell apart.
 */
const labelBox = (edge: RoutedEdge) => {
  const width = labelWidth(edge.labelText);
  const left =
    edge.labelAnchor === "middle" ? edge.label.x - width / 2 : edge.label.x;
  return {
    left,
    right: left + width,
    top: edge.label.y - LABEL_PITCH / 2,
    bottom: edge.label.y + LABEL_PITCH / 2,
  };
};

type LabelBox = ReturnType<typeof labelBox>;

const collide = (a: LabelBox, b: LabelBox): boolean =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Labels moved off each other, and only off each other.
 *
 * Two curves that fan out of one box have their midpoints a few pixels apart, so
 * their labels land on top of one another and neither can be read — the halo that
 * clears the wire behind a label does nothing about another label. The fix is a
 * pass over what the routing produced rather than a change to the routing: where
 * a label sits along its curve is a drawing decision, and every edge still owns
 * its own path.
 *
 * Labels that collide — directly, or through a chain of them — are dealt out at
 * one row apart, centred on where the group already was. Centring is what keeps
 * this honest: the group as a whole stays with its curves instead of drifting
 * downwards away from them, and a label alone in its cluster never moves at all.
 *
 * Rerun until nothing collides, since separating one cluster can push a label
 * into a neighbouring one. Bounded, because a graph dense enough not to settle
 * should end up drawn slightly imperfectly rather than not at all.
 */
const SPREAD_PASSES = 4;

export const spreadLabels = (
  edges: ReadonlyArray<RoutedEdge>
): ReadonlyArray<RoutedEdge> => {
  let spread = [...edges];

  for (let pass = 0; pass < SPREAD_PASSES; pass += 1) {
    // Empty labels are never drawn, so they are not in anyone's way.
    const drawn = spread
      .map((edge, index) => ({ edge, index, box: labelBox(edge) }))
      .filter((entry) => entry.edge.labelText !== "");

    const clusters: Array<Array<(typeof drawn)[number]>> = [];
    for (const entry of drawn) {
      const touching = clusters.filter((cluster) =>
        cluster.some((member) => collide(member.box, entry.box))
      );
      if (touching.length === 0) {
        clusters.push([entry]);
        continue;
      }
      // Joining two clusters at once is what makes the grouping transitive: a
      // label overlapping one member of each merges the three into one.
      const [first, ...rest] = touching;
      first.push(entry);
      for (const other of rest) {
        first.push(...other);
        clusters.splice(clusters.indexOf(other), 1);
      }
    }

    const crowded = clusters.filter((cluster) => cluster.length > 1);
    if (crowded.length === 0) return spread;

    const moved = [...spread];
    for (const cluster of crowded) {
      const ordered = [...cluster].sort(
        (a, b) =>
          a.edge.label.y - b.edge.label.y || a.edge.label.x - b.edge.label.x
      );
      const middle =
        ordered.reduce((sum, entry) => sum + entry.edge.label.y, 0) /
        ordered.length;
      const first = middle - ((ordered.length - 1) * LABEL_PITCH) / 2;
      ordered.forEach((entry, row) => {
        moved[entry.index] = {
          ...entry.edge,
          label: { x: entry.edge.label.x, y: first + row * LABEL_PITCH },
        };
      });
    }
    spread = moved;
  }

  return spread;
};

/** A label is not flush against a box it is merely next to. */
const NODE_CLEARANCE = 6;

const overNode = (
  edge: RoutedEdge,
  nodes: ReadonlyArray<PositionedNode>
): boolean => {
  const box = labelBox(edge);
  return nodes.some(
    (node) =>
      box.left - NODE_CLEARANCE < node.x + node.width &&
      node.x < box.right + NODE_CLEARANCE &&
      box.top < node.y + node.height &&
      node.y < box.bottom
  );
};

/**
 * How far along its curve a label may be slid to get out from under a box, and
 * in what order — outwards from the middle, alternating, so it ends up as near
 * the middle of its own line as the boxes allow.
 */
const SLIDE_STEPS = [0.08, 0.16, 0.24, 0.32, 0.4].flatMap((step) => [
  0.5 - step,
  0.5 + step,
]);

/**
 * Labels moved off the node boxes.
 *
 * An edge that skips a lane — backend straight to external, say — has the
 * middle of its curve inside whichever lane it flew over, so its label is laid
 * across a box that has nothing to do with it and is unreadable against the
 * box's own text. Sliding along the curve is what keeps the fix honest: the
 * label stays on its own line, just at the point of it that is in clear air —
 * which for a lane-skipping edge is the gutter to one side of the box.
 *
 * Only labels that sit *on* the curve are moved. The ones set beside it are
 * already placed in a gutter by the routing, and sliding those would take them
 * away from the line they name.
 */
export const clearOfNodes = (
  edges: ReadonlyArray<RoutedEdge>,
  nodes: ReadonlyArray<PositionedNode>
): ReadonlyArray<RoutedEdge> =>
  edges.map((edge) => {
    if (edge.labelText === "" || edge.labelAnchor !== "middle") return edge;
    if (!overNode(edge, nodes)) return edge;
    for (const t of SLIDE_STEPS) {
      const slid = { ...edge, label: cubicAt(edge.curve, t) };
      if (!overNode(slid, nodes)) return slid;
    }
    return edge;
  });

/**
 * Positions for every node, lane, and edge, plus the size of the whole drawing.
 *
 * Lanes are centred against the tallest one rather than hung from the top: a
 * two-node frontend beside a six-node backend reads as one flow that way, and as
 * two unrelated stacks otherwise.
 */
export const layoutPlanGraph = (
  nodes: ReadonlyArray<PlanNode>,
  edges: ReadonlyArray<PlanEdge>
): GraphLayout => {
  const lanes = groupByLane(nodes);
  const laneHeight = (count: number) =>
    count * NODE_HEIGHT + Math.max(0, count - 1) * ROW_GAP;
  const tallest = lanes.reduce(
    (most, lane) => Math.max(most, laneHeight(lane.nodes.length)),
    0
  );

  const laneBoxes: Array<LaneBox> = [];
  const positioned: Array<PositionedNode> = [];

  lanes.forEach((lane, column) => {
    const x = PADDING + column * (NODE_WIDTH + COLUMN_GAP);
    const top = PADDING + (tallest - laneHeight(lane.nodes.length)) / 2;
    laneBoxes.push({
      layer: lane.layer,
      label: laneLabel(lane.layer),
      x,
      width: NODE_WIDTH,
    });
    lane.nodes.forEach((node, row) => {
      positioned.push({
        node,
        x,
        y: top + row * (NODE_HEIGHT + ROW_GAP),
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      });
    });
  });

  const byId = new Map(positioned.map((entry) => [entry.node.id, entry]));
  const routed: Array<RoutedEdge> = [];
  for (const edge of edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from === undefined || to === undefined) continue;
    routed.push({ edge, ...routeEdge(from, to, edge.label) });
  }

  const right = positioned.reduce(
    (most, entry) => Math.max(most, entry.x + entry.width),
    0
  );
  const bottom = positioned.reduce(
    (most, entry) => Math.max(most, entry.y + entry.height),
    0
  );
  return {
    nodes: positioned,
    lanes: laneBoxes,
    edges: spreadLabels(clearOfNodes(routed, positioned)),
    width: right + PADDING,
    // Back-edges loop below the last row, so the canvas has to reserve for them.
    height: bottom + PADDING * 2,
  };
};

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

export const clampZoom = (zoom: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export const IDENTITY_VIEWPORT: Viewport = { zoom: 1, x: 0, y: 0 };

/**
 * The transform that fits the whole drawing in `size`, never magnifying past
 * 1:1 — a three-node analysis blown up to fill the pane looks like a mistake.
 */
export const fitViewport = (layout: GraphLayout, size: Size): Viewport => {
  if (layout.width <= 0 || layout.height <= 0) return IDENTITY_VIEWPORT;
  if (size.width <= 0 || size.height <= 0) return IDENTITY_VIEWPORT;
  const zoom = clampZoom(
    Math.min(1, size.width / layout.width, size.height / layout.height)
  );
  return {
    zoom,
    x: (size.width - layout.width * zoom) / 2,
    y: (size.height - layout.height * zoom) / 2,
  };
};

/** The transform that puts a node in the middle of the pane, zoom untouched. */
export const centerOn = (
  target: PositionedNode,
  size: Size,
  zoom: number
): Viewport => ({
  zoom,
  x: size.width / 2 - (target.x + target.width / 2) * zoom,
  y: size.height / 2 - (target.y + target.height / 2) * zoom,
});

/** A wheel/pinch zoom that keeps the point under the cursor where it is. */
export const zoomAt = (
  viewport: Viewport,
  factor: number,
  cursor: Point
): Viewport => {
  const zoom = clampZoom(viewport.zoom * factor);
  const ratio = zoom / viewport.zoom;
  return {
    zoom,
    x: cursor.x - (cursor.x - viewport.x) * ratio,
    y: cursor.y - (cursor.y - viewport.y) * ratio,
  };
};

export const panBy = (
  viewport: Viewport,
  dx: number,
  dy: number
): Viewport => ({
  ...viewport,
  x: viewport.x + dx,
  y: viewport.y + dy,
});
