import type { PlanNodeKind } from "@byconvo/core/plans";

/**
 * The tint a step's kind wears, shared by the drawing and the notes so a step
 * reads the same in both halves — the tint is part of how you recognise which
 * node a note belongs to.
 */
export const KIND_TONE: Readonly<Record<PlanNodeKind, string>> = {
  ui: "text-sky-500",
  state: "text-violet-500",
  route: "text-amber-500",
  handler: "text-emerald-500",
  service: "text-emerald-500",
  store: "text-orange-500",
  process: "text-fuchsia-500",
  external: "text-muted-foreground",
};
