/**
 * Keeping the notes and the drawing talking to each other, and saying plainly
 * how much of an old analysis still holds.
 */
import type {
  Plan,
  PlanAnchorResolution,
  PlanAnchorStatus,
  PlanAnnotation,
  PlanNode,
  PlanStaleness,
} from "@byconvo/core/plans";
import type {
  AnnotationTarget,
  OutlineGroup,
} from "../interfaces/plans-pane.interfaces";
import { groupByLane } from "./plan-graph.functions";

/** The resolution recorded for one node or note, if it had an anchor at all. */
export const resolutionFor = (
  staleness: PlanStaleness | undefined,
  target: PlanAnchorResolution["target"],
  targetId: string
): PlanAnchorResolution | null =>
  staleness?.anchors.find(
    (entry) => entry.target === target && entry.targetId === targetId
  ) ?? null;

/**
 * Where clicking a note should take you *now*.
 *
 * The line comes from the resolution rather than from the note, which is the
 * whole point of re-anchoring: an analysis written three commits ago still opens
 * the right line if the code merely moved. When it could not be found the target
 * survives without a line — the file is still worth opening, and the caller has
 * the status to say why it landed at the top of it.
 */
export const annotationTarget = (
  annotation: PlanAnnotation,
  staleness: PlanStaleness | undefined
): AnnotationTarget | null => {
  if (annotation.anchor === null) return null;
  const resolved = resolutionFor(staleness, "annotation", annotation.id);
  return {
    filePath: annotation.anchor.filePath,
    line: resolved === null ? annotation.anchor.line : resolved.line,
    status: resolved?.status ?? "fresh",
  };
};

/** The same, for the file a node stands for. */
export const nodeTarget = (
  plan: Plan,
  nodeId: string,
  staleness: PlanStaleness | undefined
): AnnotationTarget | null => {
  const node = plan.nodes.find((entry) => entry.id === nodeId);
  if (node === undefined || node.anchor === null) return null;
  const resolved = resolutionFor(staleness, "node", nodeId);
  return {
    filePath: node.anchor.filePath,
    line: resolved === null ? node.anchor.line : resolved.line,
    status: resolved?.status ?? "fresh",
  };
};

/** How a node's own anchor is faring — what its badge shows. */
export const nodeStatus = (
  nodeId: string,
  staleness: PlanStaleness | undefined
): PlanAnchorStatus | null =>
  resolutionFor(staleness, "node", nodeId)?.status ?? null;

/**
 * The notes in reading order: down the flow, node by node, with the analysis's
 * own note before whatever the human added under it, and anything pinned to no
 * node at the end.
 */
export const orderedAnnotations = (
  plan: Plan
): ReadonlyArray<PlanAnnotation> => {
  const rank = new Map(plan.nodes.map((node, index) => [node.id, index]));
  const originRank = (annotation: PlanAnnotation) =>
    annotation.origin === "analysis" ? 0 : 1;
  return [...plan.annotations].sort((a, b) => {
    const aRank =
      a.nodeId === null
        ? Number.MAX_SAFE_INTEGER
        : (rank.get(a.nodeId) ?? Number.MAX_SAFE_INTEGER);
    const bRank =
      b.nodeId === null
        ? Number.MAX_SAFE_INTEGER
        : (rank.get(b.nodeId) ?? Number.MAX_SAFE_INTEGER);
    if (aRank !== bRank) return aRank - bRank;
    if (originRank(a) !== originRank(b)) return originRank(a) - originRank(b);
    return a.createdAt.localeCompare(b.createdAt);
  });
};

/** The steps in the order the graph draws them: down the flow, lane by lane. */
export const flowOrderedNodes = (plan: Plan): ReadonlyArray<PlanNode> =>
  groupByLane(plan.nodes).flatMap((lane) => lane.nodes);

/**
 * The analysis as a list: every step of the flow, in the order it is drawn,
 * carrying whatever notes hang off it.
 *
 * Every step, not only the annotated ones. The list is the drawing's index, so a
 * step missing from it reads as a step missing from the analysis, and the two
 * halves stop agreeing about what exists. It also means the graph's selection
 * always has a row to light up, whether or not anyone has written about it.
 *
 * Notes pinned to no step — or to one the graph no longer draws — come last,
 * under a group with a null id.
 */
export const planOutline = (plan: Plan): ReadonlyArray<OutlineGroup> => {
  const drawn = new Set(plan.nodes.map((node) => node.id));
  const byNode = new Map<string, Array<PlanAnnotation>>();
  const loose: Array<PlanAnnotation> = [];

  for (const annotation of orderedAnnotations(plan)) {
    const nodeId = annotation.nodeId;
    if (nodeId === null || !drawn.has(nodeId)) {
      loose.push(annotation);
      continue;
    }
    const existing = byNode.get(nodeId);
    if (existing === undefined) byNode.set(nodeId, [annotation]);
    else existing.push(annotation);
  }

  const groups: Array<OutlineGroup> = flowOrderedNodes(plan).map((node) => ({
    nodeId: node.id,
    label: node.label,
    kind: node.kind,
    summary: node.summary,
    annotations: byNode.get(node.id) ?? [],
  }));

  if (loose.length === 0) return groups;
  return [
    ...groups,
    { nodeId: null, label: "", kind: null, summary: "", annotations: loose },
  ];
};

/**
 * A path split into the part that merely locates the file and the part that
 * names it, so a link can print the folders quietly and the file itself plainly.
 */
export const splitPath = (
  filePath: string
): { folders: string; name: string } => {
  const cut = filePath.lastIndexOf("/");
  return cut === -1
    ? { folders: "", name: filePath }
    : { folders: filePath.slice(0, cut + 1), name: filePath.slice(cut + 1) };
};

/**
 * Whether two links land in the same place — a note anchored to its own step's
 * line would otherwise repeat the link already shown at the head of the group.
 */
export const sameTarget = (
  a: AnnotationTarget | null,
  b: AnnotationTarget | null
): boolean =>
  a !== null && b !== null && a.filePath === b.filePath && a.line === b.line;

/**
 * What to tell the reader about an analysis that has aged.
 *
 * Silence when everything still lines up, a quiet note when things only moved,
 * and an outright "rerun this" once anchors point at code that is gone —
 * because at that point the drawing is describing a version of the codebase that
 * no longer exists, and the honest thing is to say so rather than to render it
 * as though it were current.
 */
export const stalenessMessage = (
  staleness: PlanStaleness | undefined
): { tone: "ok" | "moved" | "stale"; text: string } | null => {
  if (staleness === undefined) return null;
  const gone = staleness.lost + staleness.missing;
  if (gone > 0) {
    const subject =
      gone === 1 ? "anchor no longer matches" : "anchors no longer match";
    return {
      tone: "stale",
      text: `${gone} ${subject} the code — this analysis was made against an older version and should be rerun.`,
    };
  }
  if (staleness.relocated > 0) {
    const places = staleness.relocated === 1 ? "place" : "places";
    return {
      tone: "moved",
      text: `The code moved in ${staleness.relocated} ${places} since this ran; the links have been followed to where it is now.`,
    };
  }
  return { tone: "ok", text: "Matches the working tree." };
};

/** How a status reads on a node badge or beside a note. */
export const statusLabel = (status: PlanAnchorStatus): string =>
  ({
    fresh: "Matches the code",
    relocated: "The code moved — link followed",
    lost: "This line is gone — rerun the analysis",
    missing: "This file is gone — rerun the analysis",
  })[status];

/** True once a status means the analysis is describing code that isn't there. */
export const isBrokenAnchor = (status: PlanAnchorStatus): boolean =>
  status === "lost" || status === "missing";
