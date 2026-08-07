import * as Schema from "effect/Schema";

/**
 * Lanes the graph reads left to right. The order here *is* the horizontal
 * order, which is what makes "frontend to backend" a property of the data
 * rather than of the layout code.
 */
export const PLAN_LAYERS = [
  "entry",
  "frontend",
  "transport",
  "backend",
  "data",
  "external",
] as const;
export const PlanLayer = Schema.Literals(PLAN_LAYERS);
export type PlanLayer = typeof PlanLayer.Type;

export const PlanNodeKind = Schema.Literals([
  "ui",
  "state",
  "route",
  "handler",
  "service",
  "store",
  "process",
  "external",
]);
export type PlanNodeKind = typeof PlanNodeKind.Type;

/**
 * Where a node or an annotation points in the codebase.
 *
 * `snippet` and `fileHash` are what make an old analysis re-checkable: the hash
 * says whether the file is the one that was analysed, and the snippet is the
 * line's own text, which is how a still-present line is found again after
 * everything around it moved. Neither is a lookup key — they only ever decide
 * how much of the analysis is still true.
 */
export const PlanAnchor = Schema.Struct({
  /** Repository-relative POSIX path. */
  filePath: Schema.String,
  /** One-based line, or null to anchor at the file as a whole. */
  line: Schema.NullOr(Schema.Number),
  /** The anchored line's text, trimmed, as it read when the analysis ran. */
  snippet: Schema.String,
  /** Fingerprint of the whole file at that moment. */
  fileHash: Schema.String,
});
export type PlanAnchor = typeof PlanAnchor.Type;

export const PlanNode = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  layer: PlanLayer,
  kind: PlanNodeKind,
  /** One line on what this step does — the node's body text in the graph. */
  summary: Schema.String,
  anchor: Schema.NullOr(PlanAnchor),
  /** Rank within the lane; ties fall back to declaration order. */
  order: Schema.Number,
});
export type PlanNode = typeof PlanNode.Type;

export const PlanEdgeKind = Schema.Literals(["call", "data", "event"]);
export type PlanEdgeKind = typeof PlanEdgeKind.Type;

export const PlanEdge = Schema.Struct({
  id: Schema.String,
  from: Schema.String,
  to: Schema.String,
  label: Schema.String,
  kind: PlanEdgeKind,
});
export type PlanEdge = typeof PlanEdge.Type;

/**
 * Both the notes the analysis leaves at relevant places and the ones the human
 * leaves while reading it — one shape, because both are a body of text pinned to
 * a node and a line, and every screen that renders one renders the other.
 *
 * `origin` is the whole difference: an "analysis" note is part of the finding
 * and survives saving, a "review" note is the human's working annotation and is
 * cleared when the analysis is saved.
 */
export const PlanAnnotationOrigin = Schema.Literals(["analysis", "review"]);
export type PlanAnnotationOrigin = typeof PlanAnnotationOrigin.Type;

export const PlanAnnotation = Schema.Struct({
  id: Schema.String,
  origin: PlanAnnotationOrigin,
  /** The node it hangs off, or null for a note about the analysis itself. */
  nodeId: Schema.NullOr(Schema.String),
  body: Schema.String,
  author: Schema.String,
  createdAt: Schema.String,
  anchor: Schema.NullOr(PlanAnchor),
});
export type PlanAnnotation = typeof PlanAnnotation.Type;

export const Plan = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  /** What the human asked the agent to analyse. */
  question: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  /** When the analysis was last saved, or null while it is still a draft. */
  savedAt: Schema.NullOr(Schema.String),
  nodes: Schema.Array(PlanNode),
  edges: Schema.Array(PlanEdge),
  annotations: Schema.Array(PlanAnnotation),
});
export type Plan = typeof Plan.Type;

/** A plan without its graph — what the pane's picker lists. */
export const PlanSummary = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  question: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  savedAt: Schema.NullOr(Schema.String),
  nodeCount: Schema.Number,
  annotationCount: Schema.Number,
});
export type PlanSummary = typeof PlanSummary.Type;

/**
 * How much of an anchor still holds.
 *
 * - `fresh` — the file is byte-for-byte the one that was analysed.
 * - `relocated` — the file changed, but the anchored line was found again; the
 *   resolution carries the line it is on now.
 * - `lost` — the file changed and the line is gone (or is now ambiguous).
 * - `missing` — the file itself is gone.
 *
 * Only `lost` and `missing` mean the analysis is telling you about code that is
 * no longer there, which is the point at which it needs rerunning.
 */
export const PlanAnchorStatus = Schema.Literals([
  "fresh",
  "relocated",
  "lost",
  "missing",
]);
export type PlanAnchorStatus = typeof PlanAnchorStatus.Type;

export const PlanAnchorTarget = Schema.Literals(["node", "annotation"]);
export type PlanAnchorTarget = typeof PlanAnchorTarget.Type;

export const PlanAnchorResolution = Schema.Struct({
  target: PlanAnchorTarget,
  /** Id of the node or annotation the anchor belongs to. */
  targetId: Schema.String,
  filePath: Schema.String,
  status: PlanAnchorStatus,
  /** Where to go now — the relocated line, or null when it could not be found. */
  line: Schema.NullOr(Schema.Number),
  /** Where the analysis said it was, so a move can be shown as a move. */
  recordedLine: Schema.NullOr(Schema.Number),
});
export type PlanAnchorResolution = typeof PlanAnchorResolution.Type;

export const PlanStaleness = Schema.Struct({
  checkedAt: Schema.String,
  anchors: Schema.Array(PlanAnchorResolution),
  fresh: Schema.Number,
  relocated: Schema.Number,
  lost: Schema.Number,
  missing: Schema.Number,
  /** True once any anchor points at code that is no longer there. */
  needsRerun: Schema.Boolean,
});
export type PlanStaleness = typeof PlanStaleness.Type;

/** A plan plus the verdict on how well it still matches the working tree. */
export const PlanView = Schema.Struct({
  plan: Plan,
  staleness: PlanStaleness,
});
export type PlanView = typeof PlanView.Type;

/**
 * What an agent posts once it has worked the analysis out. Anchors arrive as a
 * path and a line — the snippet and the file hash are stamped on by the server,
 * which is the side that can read the file.
 */
export const NewPlanAnchor = Schema.Struct({
  filePath: Schema.String,
  line: Schema.optionalKey(Schema.NullOr(Schema.Number)),
});
export type NewPlanAnchor = typeof NewPlanAnchor.Type;

export const NewPlanNode = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  layer: PlanLayer,
  kind: Schema.optionalKey(PlanNodeKind),
  summary: Schema.optionalKey(Schema.String),
  anchor: Schema.optionalKey(Schema.NullOr(NewPlanAnchor)),
  order: Schema.optionalKey(Schema.Number),
});
export type NewPlanNode = typeof NewPlanNode.Type;

export const NewPlanEdge = Schema.Struct({
  from: Schema.String,
  to: Schema.String,
  label: Schema.optionalKey(Schema.String),
  kind: Schema.optionalKey(PlanEdgeKind),
});
export type NewPlanEdge = typeof NewPlanEdge.Type;

export const NewPlanAnnotation = Schema.Struct({
  nodeId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  body: Schema.String,
  anchor: Schema.optionalKey(Schema.NullOr(NewPlanAnchor)),
});
export type NewPlanAnnotation = typeof NewPlanAnnotation.Type;

export const NewPlan = Schema.Struct({
  title: Schema.String,
  question: Schema.optionalKey(Schema.String),
  nodes: Schema.Array(NewPlanNode),
  edges: Schema.Array(NewPlanEdge),
  annotations: Schema.optionalKey(Schema.Array(NewPlanAnnotation)),
});
export type NewPlan = typeof NewPlan.Type;

/** A note the human adds while reading — always `review`, never `analysis`. */
export const NewReviewAnnotation = Schema.Struct({
  nodeId: Schema.optionalKey(Schema.NullOr(Schema.String)),
  body: Schema.String,
  author: Schema.optionalKey(Schema.String),
  anchor: Schema.optionalKey(Schema.NullOr(NewPlanAnchor)),
});
export type NewReviewAnnotation = typeof NewReviewAnnotation.Type;

export const PlanIdParam = Schema.Struct({ id: Schema.String });
export const PlanAnnotationParams = Schema.Struct({
  id: Schema.String,
  annotationId: Schema.String,
});
