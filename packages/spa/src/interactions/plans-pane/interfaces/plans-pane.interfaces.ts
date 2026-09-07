/**
 * `plans-pane` feature — the analysis split beside the app canvas, opened from
 * the window bar's plan icon.
 *
 * An analysis is a graph an agent worked out: how a piece of behaviour travels
 * from the frontend to the backend, with notes left at the places that matter.
 * The pane's job is to draw it, keep it in step with the notes beside it, and be
 * honest about the parts that no longer match the code.
 *
 * Layout is deliberately plain data — positions and path strings computed from
 * the graph — so what the pane draws can be asserted on without a renderer.
 */
import type {
  PlanAnchorStatus,
  PlanAnnotation,
  PlanEdge,
  PlanLayer,
  PlanNode,
  PlanNodeKind,
} from "@reviewer/core/plans";

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface PositionedNode {
  readonly node: PlanNode;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A column of the graph — one lane per layer that actually has nodes in it. */
export interface LaneBox {
  readonly layer: PlanLayer;
  readonly label: string;
  readonly x: number;
  readonly width: number;
}

/**
 * Centred on the curve, or set beside it — a run between two stacked boxes is
 * too short to carry a label on top of.
 */
export type LabelAnchor = "middle" | "start";

/** The cubic an edge is drawn as: its two ends and its two control points. */
export interface Curve {
  readonly from: Point;
  readonly c1: Point;
  readonly c2: Point;
  readonly to: Point;
}

export interface RoutedEdge {
  readonly edge: PlanEdge;
  /** SVG path data from the source node's face to the target's. */
  readonly path: string;
  /** The same curve as points, so a label can be slid along it. */
  readonly curve: Curve;
  readonly label: Point;
  readonly labelAnchor: LabelAnchor;
  /** The label as drawn — clipped to the room it has beside the wire. */
  readonly labelText: string;
}

export interface GraphLayout {
  readonly nodes: ReadonlyArray<PositionedNode>;
  readonly lanes: ReadonlyArray<LaneBox>;
  readonly edges: ReadonlyArray<RoutedEdge>;
  readonly width: number;
  readonly height: number;
}

/** Pan and zoom over the graph, applied as one SVG transform. */
export interface Viewport {
  readonly zoom: number;
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * What the pane is looking at. One selection drives both halves: picking a node
 * on the graph scrolls its notes into view, and picking a note focuses its node
 * — the two-way sync is this single field plus a nudge to scroll.
 */
export interface PlansPaneState {
  /** The plan on screen, or null before one is picked. */
  readonly planId: string | null;
  /**
   * Whether the pane still tracks whatever analysis is newest. True until the
   * reader picks one themselves, which is the point at which swapping it out
   * from under them would be the wrong thing to do.
   */
  readonly followLatest: boolean;
  readonly selectedNodeId: string | null;
  readonly selectedAnnotationId: string | null;
  readonly viewport: Viewport;
  /**
   * Bumped whenever a selection is made from the notes side, so the graph knows
   * to recentre rather than merely re-highlight. A counter rather than a
   * boolean: two picks of the same node have to read as two requests.
   */
  readonly focusRequest: number;
}

/**
 * One step of the flow as the list shows it, with whatever notes hang off it —
 * a step with none still gets a group, so the list stays a complete index of
 * the drawing. `nodeId` is null for the trailing group of loose notes.
 */
export interface OutlineGroup {
  readonly nodeId: string | null;
  readonly label: string;
  readonly kind: PlanNodeKind | null;
  /** The step's one-line description, as shown in its box on the graph. */
  readonly summary: string;
  readonly annotations: ReadonlyArray<PlanAnnotation>;
}

/** A note with the verdict on whether its anchor still finds anything. */
export interface AnnotationTarget {
  readonly filePath: string;
  /** Where to open now — the relocated line when the code moved. */
  readonly line: number | null;
  readonly status: PlanAnchorStatus;
}
