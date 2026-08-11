/**
 * The analysis, drawn.
 *
 * One SVG holding the whole graph under a single pan/zoom transform: the layout
 * is computed once from the plan, so nothing here decides where anything goes —
 * it draws what `layoutPlanGraph` worked out and reports clicks back to the
 * store. That is also why the two-way sync needs no coordination: this component
 * renders the selection, and setting it is someone else's job.
 */
import { IconAlertTriangle } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Plan, PlanStaleness } from "@byconvo/core/plans";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import {
  centerOn,
  fitViewport,
  LABEL_BOX_HEIGHT,
  LABEL_BOX_WIDTH,
  layoutPlanGraph,
  NODE_HEIGHT,
  panBy,
  zoomAt,
} from "../functions/plan-graph.functions";
import {
  isBrokenAnchor,
  nodeStatus,
  splitPath,
  statusLabel,
} from "../functions/plans-pane.functions";
import { setViewport } from "../adapters/plans-pane.store";
import { KIND_LABEL, KIND_PILL, KIND_PILL_SHAPE } from "./plan-node-tone";
import type { Size, Viewport } from "../interfaces/plans-pane.interfaces";
import { cn } from "@/lib/utils";

/**
 * Pointer capture is what keeps a drag alive once the pointer leaves the canvas.
 * It is guarded because releasing a capture that was never taken throws, and a
 * pan that ends off the edge of the window is exactly when that happens.
 */
const capture = (element: Element, pointerId: number) => {
  if (typeof element.setPointerCapture !== "function") return;
  element.setPointerCapture(pointerId);
};

const release = (element: Element, pointerId: number) => {
  if (typeof element.hasPointerCapture !== "function") return;
  if (element.hasPointerCapture(pointerId))
    element.releasePointerCapture(pointerId);
};

export function PlanGraph({
  plan,
  staleness,
  viewport,
  selectedNodeId,
  focusRequest,
  onSelectNode,
  onOpenNode,
}: {
  plan: Plan;
  staleness: PlanStaleness | undefined;
  viewport: Viewport;
  selectedNodeId: string | null;
  focusRequest: number;
  onSelectNode: (nodeId: string | null) => void;
  onOpenNode: (nodeId: string) => void;
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const layout = useMemo(
    () => layoutPlanGraph(plan.nodes, plan.edges),
    [plan.nodes, plan.edges]
  );

  useEffect(() => {
    const element = frame.current;
    if (element === null) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // A newly opened analysis is framed to fit; after that the viewport is the
  // reader's, and only an explicit focus moves it.
  useEffect(() => {
    if (size.width === 0) return;
    setViewport(fitViewport(layout, size));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.id, layout, size.width, size.height]);

  /**
   * The other half of the sync: a note was picked, so bring its node into view.
   * Keyed on the request counter rather than on the selection, so picking the
   * same node twice recentres both times.
   */
  useEffect(() => {
    if (focusRequest === 0 || selectedNodeId === null || size.width === 0) {
      return;
    }
    const target = layout.nodes.find(
      (entry) => entry.node.id === selectedNodeId
    );
    if (target === undefined) return;
    setViewport(centerOn(target, size, viewport.zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  const dragging = useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={frame}
      className="plans-canvas relative min-h-0 flex-1 overflow-hidden"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        dragging.current = { x: event.clientX, y: event.clientY };
        capture(event.currentTarget, event.pointerId);
      }}
      onPointerMove={(event) => {
        const from = dragging.current;
        if (from === null) return;
        setViewport(
          panBy(viewport, event.clientX - from.x, event.clientY - from.y)
        );
        dragging.current = { x: event.clientX, y: event.clientY };
      }}
      onPointerUp={(event) => {
        dragging.current = null;
        release(event.currentTarget, event.pointerId);
      }}
      onPointerCancel={(event) => {
        dragging.current = null;
        release(event.currentTarget, event.pointerId);
      }}
      onWheel={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const cursor = {
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        };
        // Pinch-zoom arrives as a ctrl-wheel; a plain wheel scrolls the canvas.
        if (event.ctrlKey || event.metaKey) {
          setViewport(zoomAt(viewport, Math.exp(-event.deltaY / 240), cursor));
          return;
        }
        setViewport(panBy(viewport, -event.deltaX, -event.deltaY));
      }}
    >
      <svg
        role="presentation"
        className="absolute inset-0 size-full"
        onClick={(event) => {
          if (event.target === event.currentTarget) onSelectNode(null);
        }}
      >
        <defs>
          <marker
            id="plan-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-border" />
          </marker>
        </defs>
        <g
          transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}
        >
          {layout.lanes.map((lane) => (
            <text
              key={lane.layer}
              x={lane.x}
              y={20}
              className="fill-muted-foreground text-[0.6875rem] font-medium"
            >
              {lane.label}
            </text>
          ))}

          {layout.edges.map((routed) => (
            <path
              key={routed.edge.id}
              d={routed.path}
              fill="none"
              markerEnd="url(#plan-arrow)"
              className="stroke-border"
              strokeWidth={1.5}
            />
          ))}

          {layout.nodes.map(({ node, x, y, width, height }) => {
            const status = nodeStatus(node.id, staleness);
            const broken = status !== null && isBrokenAnchor(status);
            const selected = node.id === selectedNodeId;
            return (
              <foreignObject
                key={node.id}
                x={x}
                y={y}
                width={width}
                height={height}
                // Boxes overlap the wires; without this the wire under a box
                // would still take the click.
                className="overflow-visible"
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  title={status === null ? node.label : statusLabel(status)}
                  style={{ height: NODE_HEIGHT }}
                  className={cn(
                    "plan-node group flex w-full flex-col justify-center gap-1 overflow-hidden rounded-md border px-3 py-2 text-left transition-shadow",
                    selected
                      ? "border-primary shadow-md ring-2 ring-primary/30"
                      : "border-frame-border hover:shadow-sm",
                    broken && !selected && "border-dashed border-destructive/60"
                  )}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onSelectNode(selected ? null : node.id)}
                  onDoubleClick={() => onOpenNode(node.id)}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={cn(KIND_PILL_SHAPE, KIND_PILL[node.kind])}>
                      {KIND_LABEL[node.kind]}
                    </span>
                    {broken && (
                      <IconAlertTriangle className="size-3 text-destructive" />
                    )}
                  </div>
                  <div className="truncate text-[0.8125rem] leading-5 font-medium">
                    {node.label}
                  </div>
                  {node.summary !== "" ? (
                    <div className="line-clamp-2 text-[0.6875rem] leading-4 text-muted-foreground">
                      {node.summary}
                    </div>
                  ) : (
                    node.anchor !== null && (
                      <div className="flex items-center gap-1 truncate text-[0.6875rem] leading-4 text-muted-foreground">
                        <FileTypeIcon
                          path={node.anchor.filePath}
                          className="size-3.5 shrink-0"
                        />
                        <span className="truncate">
                          {splitPath(node.anchor.filePath).name}
                        </span>
                      </div>
                    )
                  )}
                </button>
              </foreignObject>
            );
          })}

          {/* Last, so a label is over every wire and every box rather than
              under the next thing the graph happens to draw. The layout keeps
              them off the boxes where it can; this is what makes the ones it
              cannot place elsewhere still readable. */}
          {layout.edges.map(
            (routed) =>
              routed.labelText !== "" && (
                /* The label clears the wire behind it with a chip, not with a
                   stroke around its glyphs: a 6px stroke on letterforms spikes
                   at every join and traces the outline of the word, which is
                   what made these read as torn rather than as laid on top.

                   It is HTML so the chip is exactly as wide as the text —
                   nothing here has to guess at a width. The box around it is
                   deliberately larger and takes no pointer, so only the chip
                   itself is a target and the empty room stays part of the
                   canvas you can drag. */
                <foreignObject
                  key={routed.edge.id}
                  x={
                    routed.labelAnchor === "middle"
                      ? routed.label.x - LABEL_BOX_WIDTH / 2
                      : routed.label.x
                  }
                  y={routed.label.y - LABEL_BOX_HEIGHT / 2}
                  width={LABEL_BOX_WIDTH}
                  height={LABEL_BOX_HEIGHT}
                  className="pointer-events-none overflow-visible"
                >
                  <div
                    className={cn(
                      "flex h-full items-center",
                      routed.labelAnchor === "middle"
                        ? "justify-center"
                        : "justify-start"
                    )}
                  >
                    {/* Clipped to fit the gutter; the whole of it is on hover. */}
                    <span
                      title={routed.edge.label}
                      className="pointer-events-auto rounded bg-pane px-1 py-0.5 text-[0.625rem] leading-none whitespace-nowrap text-muted-foreground"
                    >
                      {routed.labelText}
                    </span>
                  </div>
                </foreignObject>
              )
          )}
        </g>
      </svg>
    </div>
  );
}
