/**
 * Laying an analysis out.
 *
 * The graph is a flow, not a free-form diagram: every node declares the layer it
 * belongs to, the layers have a fixed order, and that order is the horizontal
 * one. So "frontend on the left, backend on the right" needs no force
 * simulation and no layout library — it is a grouped sort, which is also why the
 * result is stable between renders and assertable in a test.
 */
import { PLAN_LAYERS } from "@byconvo/core/plans";
import type { PlanEdge, PlanLayer, PlanNode } from "@byconvo/core/plans";
import type {
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
export const NODE_HEIGHT = 84;
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
 * A label clipped to the room it actually has.
 *
 * Edge labels are centred on the wire, so a label wider than the gap it sits in
 * spills over the boxes on both sides and collides with their text. Clipping
 * keeps the drawing readable; the full text is still available on the element
 * itself, so nothing is lost, only deferred to a hover.
 */
export const fitLabel = (text: string, available: number): string => {
  const capacity = Math.max(6, Math.floor(available / LABEL_CHAR_WIDTH));
  if (text.length <= capacity) return text;
  return `${text.slice(0, capacity - 1).trimEnd()}…`;
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

const cubic = (from: Point, c1: Point, c2: Point, to: Point): string =>
  `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`;

/** A cubic Bézier's own midpoint — where a label sits on the curve, not beside it. */
export const cubicMidpoint = (
  from: Point,
  c1: Point,
  c2: Point,
  to: Point
): Point => ({
  x: (from.x + 3 * c1.x + 3 * c2.x + to.x) / 8,
  y: (from.y + 3 * c1.y + 3 * c2.y + to.y) / 8,
});

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
  label: Point;
  labelAnchor: LabelAnchor;
  labelText: string;
} => {
  if (to.x > from.x) {
    const start = { x: from.x + from.width, y: from.y + from.height / 2 };
    const end = { x: to.x, y: to.y + to.height / 2 };
    const reach = Math.max(48, (end.x - start.x) / 2);
    const c1 = { x: start.x + reach, y: start.y };
    const c2 = { x: end.x - reach, y: end.y };
    return {
      path: cubic(start, c1, c2, end),
      label: cubicMidpoint(start, c1, c2, end),
      labelAnchor: "middle",
      labelText: fitLabel(text, GUTTER_ROOM),
    };
  }

  const sameLane = to.x === from.x;
  if (sameLane && to.y > from.y) {
    const start = { x: from.x + from.width / 2, y: from.y + from.height };
    const end = { x: to.x + to.width / 2, y: to.y };
    const reach = Math.max(12, (end.y - start.y) / 2);
    const c1 = { x: start.x, y: start.y + reach };
    const c2 = { x: end.x, y: end.y - reach };
    const middle = cubicMidpoint(start, c1, c2, end);
    return {
      path: cubic(start, c1, c2, end),
      // The run between two stacked boxes is only a row gap tall, so a label
      // centred on it would sit on the boxes. It goes beside the line instead,
      // in the gutter the lanes already leave free.
      label: {
        x: from.x + from.width + GUTTER_OFFSET,
        y: middle.y,
      },
      labelAnchor: "start",
      labelText: fitLabel(text, GUTTER_ROOM - GUTTER_OFFSET),
    };
  }

  if (sameLane) {
    const start = { x: from.x + from.width, y: from.y + from.height / 2 };
    const end = { x: to.x + to.width, y: to.y + to.height / 2 };
    const bow = 44;
    const c1 = { x: start.x + bow, y: start.y };
    const c2 = { x: end.x + bow, y: end.y };
    return {
      path: cubic(start, c1, c2, end),
      label: cubicMidpoint(start, c1, c2, end),
      labelAnchor: "start",
      labelText: fitLabel(text, GUTTER_ROOM),
    };
  }

  const start = { x: from.x + from.width / 2, y: from.y + from.height };
  const end = { x: to.x + to.width / 2, y: to.y + to.height };
  const drop = Math.max(56, Math.abs(start.x - end.x) / 3);
  const c1 = { x: start.x, y: start.y + drop };
  const c2 = { x: end.x, y: end.y + drop };
  return {
    path: cubic(start, c1, c2, end),
    label: cubicMidpoint(start, c1, c2, end),
    labelAnchor: "middle",
    // The loop runs below every box, so the label has the whole span it crosses.
    labelText: fitLabel(text, Math.abs(end.x - start.x)),
  };
};

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
    edges: routed,
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
