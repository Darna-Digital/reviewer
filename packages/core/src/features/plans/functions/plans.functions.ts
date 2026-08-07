import type {
  NewPlan,
  NewPlanAnnotation,
  NewPlanEdge,
  NewPlanNode,
  Plan,
  PlanAnchor,
  PlanAnchorResolution,
  PlanAnnotation,
  PlanEdge,
  PlanNode,
  PlanStaleness,
  PlanSummary,
} from "../schema/plans.schema.ts";

/**
 * 64-bit FNV-1a as two 32-bit streams, hex.
 *
 * A file fingerprint here only ever answers "is this the same file the analysis
 * read", and a wrong answer costs a re-anchoring pass rather than a wrong
 * result — so this is deliberately a plain function instead of a dependency on
 * a crypto implementation that core has no business knowing about.
 */
export const fingerprint = (content: string): string => {
  let low = 0x811c9dc5;
  let high = 0x01000193;
  for (let index = 0; index < content.length; index += 1) {
    const code = content.charCodeAt(index);
    low = Math.imul(low ^ code, 0x01000193) >>> 0;
    high = Math.imul(high ^ (code + index), 0x85ebca6b) >>> 0;
  }
  return `${low.toString(16).padStart(8, "0")}${high.toString(16).padStart(8, "0")}`;
};

const lineAt = (content: string, line: number): string | null => {
  const lines = content.split("\n");
  const found = lines[line - 1];
  return found === undefined ? null : found.trim();
};

/** The snippet an anchor should carry for `line` in `content`. */
export const snippetFor = (content: string, line: number | null): string =>
  line === null ? "" : (lineAt(content, line) ?? "");

export const makeAnchor = (
  filePath: string,
  line: number | null,
  content: string
): PlanAnchor => ({
  filePath,
  line,
  snippet: snippetFor(content, line),
  fileHash: fingerprint(content),
});

/**
 * Where an anchor points now, given the file as it currently reads (`null` when
 * it is gone).
 *
 * An unchanged file is taken at its word. A changed one is re-anchored by
 * looking for the recorded line's own text: found once, that is where it went;
 * found several times, the occurrence nearest where it used to be wins, since
 * code moves short distances far more often than it teleports past a copy of
 * itself. Found not at all — or with nothing to search for — the anchor is lost,
 * and saying so is the point: that is what tells the reader the analysis is
 * describing code that isn't there any more.
 */
export const resolveAnchor = (
  anchor: PlanAnchor,
  content: string | null
): { status: PlanAnchorResolution["status"]; line: number | null } => {
  if (content === null) return { status: "missing", line: null };
  if (fingerprint(content) === anchor.fileHash) {
    return { status: "fresh", line: anchor.line };
  }
  if (anchor.line === null) return { status: "relocated", line: null };
  if (anchor.snippet.length === 0) return { status: "lost", line: null };

  const matches: Array<number> = [];
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index].trim() === anchor.snippet) matches.push(index + 1);
  }
  if (matches.length === 0) return { status: "lost", line: null };

  const was = anchor.line;
  const nearest = matches.reduce((best, candidate) =>
    Math.abs(candidate - was) < Math.abs(best - was) ? candidate : best
  );
  return { status: "relocated", line: nearest };
};

/** Every anchor in a plan, tagged with what it belongs to. */
export const planAnchors = (
  plan: Plan
): ReadonlyArray<{
  target: PlanAnchorResolution["target"];
  targetId: string;
  anchor: PlanAnchor;
}> => [
  ...plan.nodes.flatMap((node) =>
    node.anchor === null
      ? []
      : [{ target: "node" as const, targetId: node.id, anchor: node.anchor }]
  ),
  ...plan.annotations.flatMap((annotation) =>
    annotation.anchor === null
      ? []
      : [
          {
            target: "annotation" as const,
            targetId: annotation.id,
            anchor: annotation.anchor,
          },
        ]
  ),
];

/** The distinct files a plan's anchors touch — what the caller has to read. */
export const planAnchorPaths = (plan: Plan): ReadonlyArray<string> => [
  ...new Set(planAnchors(plan).map((entry) => entry.anchor.filePath)),
];

/**
 * The verdict on a whole plan. `sources` maps each anchored path to its current
 * contents, or to null when the file is gone; a path absent from the map is
 * read as gone too, so a caller that failed to read a file cannot accidentally
 * report the analysis as still fresh.
 */
export const checkPlanStaleness = (
  plan: Plan,
  sources: ReadonlyMap<string, string | null>,
  checkedAt: string
): PlanStaleness => {
  const anchors = planAnchors(plan).map(
    ({ target, targetId, anchor }): PlanAnchorResolution => {
      const resolved = resolveAnchor(
        anchor,
        sources.get(anchor.filePath) ?? null
      );
      return {
        target,
        targetId,
        filePath: anchor.filePath,
        status: resolved.status,
        line: resolved.line,
        recordedLine: anchor.line,
      };
    }
  );
  const count = (status: PlanAnchorResolution["status"]) =>
    anchors.filter((entry) => entry.status === status).length;
  const lost = count("lost");
  const missing = count("missing");
  return {
    checkedAt,
    anchors,
    fresh: count("fresh"),
    relocated: count("relocated"),
    lost,
    missing,
    needsRerun: lost + missing > 0,
  };
};

/**
 * Saving an analysis: the review notes go, the analysis's own stay.
 *
 * The human's notes are working annotations — they exist to be read, argued
 * with and handed to an agent, and keeping them in a saved finding would leave
 * a record of a conversation rather than of the analysis.
 */
export const saveAnalysis = (plan: Plan, savedAt: string): Plan => ({
  ...plan,
  savedAt,
  updatedAt: savedAt,
  annotations: plan.annotations.filter(
    (annotation) => annotation.origin === "analysis"
  ),
});

export const summarizePlan = (plan: Plan): PlanSummary => ({
  id: plan.id,
  title: plan.title,
  question: plan.question,
  createdAt: plan.createdAt,
  updatedAt: plan.updatedAt,
  savedAt: plan.savedAt,
  nodeCount: plan.nodes.length,
  annotationCount: plan.annotations.length,
});

/**
 * A graph is authored by an agent, so it arrives as a claim rather than as a
 * guarantee. Duplicate node ids collapse to the first, and an edge whose ends
 * are not both present is dropped — a dangling edge would otherwise be laid out
 * against a node that does not exist.
 */
export const normalizeGraph = (
  nodes: ReadonlyArray<PlanNode>,
  edges: ReadonlyArray<PlanEdge>
): { nodes: ReadonlyArray<PlanNode>; edges: ReadonlyArray<PlanEdge> } => {
  const seen = new Set<string>();
  const keptNodes = nodes.filter((node) => {
    if (node.id.length === 0 || seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
  const keptEdges = edges.filter(
    (edge) => edge.from !== edge.to && seen.has(edge.from) && seen.has(edge.to)
  );
  return { nodes: keptNodes, edges: keptEdges };
};

interface BuildPlanInput {
  readonly id: string;
  readonly input: NewPlan;
  readonly now: string;
  readonly author: string;
  /** Turns a posted `{filePath, line}` into a fingerprinted anchor. */
  readonly anchorFor: (
    anchor: { filePath: string; line?: number | null } | null | undefined
  ) => PlanAnchor | null;
  /** Ids for the annotations, in the order they are built. */
  readonly annotationId: (index: number) => string;
}

const nodeFrom = (
  node: NewPlanNode,
  index: number,
  anchorFor: BuildPlanInput["anchorFor"]
): PlanNode => ({
  id: node.id,
  label: node.label,
  layer: node.layer,
  kind: node.kind ?? "service",
  summary: node.summary ?? "",
  anchor: anchorFor(node.anchor),
  order: node.order ?? index,
});

const edgeFrom = (edge: NewPlanEdge, index: number): PlanEdge => ({
  id: `e${index}`,
  from: edge.from,
  to: edge.to,
  label: edge.label ?? "",
  kind: edge.kind ?? "call",
});

const annotationFrom = (
  annotation: NewPlanAnnotation,
  index: number,
  build: BuildPlanInput
): PlanAnnotation => ({
  id: build.annotationId(index),
  origin: "analysis",
  nodeId: annotation.nodeId ?? null,
  body: annotation.body,
  author: build.author,
  createdAt: build.now,
  anchor: build.anchorFor(annotation.anchor),
});

/** The posted analysis as a stored plan: defaults filled, graph normalized. */
export const buildPlan = (build: BuildPlanInput): Plan => {
  const { nodes, edges } = normalizeGraph(
    build.input.nodes.map((node, index) =>
      nodeFrom(node, index, build.anchorFor)
    ),
    build.input.edges.map(edgeFrom)
  );
  const nodeIds = new Set(nodes.map((node) => node.id));
  return {
    id: build.id,
    title: build.input.title,
    question: build.input.question ?? "",
    createdAt: build.now,
    updatedAt: build.now,
    savedAt: null,
    nodes,
    edges,
    annotations: (build.input.annotations ?? [])
      .map((annotation, index) => annotationFrom(annotation, index, build))
      .map((annotation) =>
        annotation.nodeId !== null && !nodeIds.has(annotation.nodeId)
          ? { ...annotation, nodeId: null }
          : annotation
      ),
  };
};
