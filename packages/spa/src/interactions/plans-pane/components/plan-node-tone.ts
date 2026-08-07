import type { PlanNodeKind } from "@byconvo/core/plans";

/**
 * How a step's kind reads. `ui` is an initialism and stays set; the rest are
 * ordinary words and are written as ordinary words.
 */
export const KIND_LABEL: Readonly<Record<PlanNodeKind, string>> = {
  ui: "UI",
  state: "State",
  route: "Route",
  handler: "Handler",
  service: "Service",
  store: "Store",
  process: "Process",
  external: "External",
};

/**
 * The pill a step's kind wears, shared by the drawing and the list so a step
 * reads the same in both halves — the colour is part of how you recognise which
 * node a note belongs to.
 *
 * A tinted ground with matching ink rather than a saturated fill: these sit in
 * quantity on a dotted canvas, and eight solid badges would compete with the
 * flow itself. Each theme sets its own pair rather than inverting, so the ink
 * keeps its contrast against the tint either way.
 */
export const KIND_PILL: Readonly<Record<PlanNodeKind, string>> = {
  ui: "bg-sky-500/10 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300",
  state:
    "bg-violet-500/10 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300",
  route:
    "bg-amber-500/10 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300",
  handler:
    "bg-teal-500/10 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300",
  service:
    "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300",
  store:
    "bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300",
  process:
    "bg-fuchsia-500/10 text-fuchsia-700 dark:bg-fuchsia-400/15 dark:text-fuchsia-300",
  external:
    "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-400/15 dark:text-zinc-300",
};

/**
 * Shape and type of the pill, shared so the two halves cannot drift apart. The
 * leading is pinned rather than inherited because the graph's box height is
 * computed from it — see `NODE_HEIGHT`.
 */
export const KIND_PILL_SHAPE =
  "shrink-0 rounded-md px-1.5 py-0.5 text-[0.625rem] leading-3.5 font-medium";
