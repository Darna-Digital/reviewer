/**
 * The analysis, drawn.
 *
 * One SVG holding the whole graph under a single pan/zoom transform: the layout
 * is computed once from the plan, so nothing here decides where anything goes —
 * it draws what `layoutPlanGraph` worked out and reports clicks back to the
 * store. That is also why the two-way sync needs no coordination: this component
 * renders the selection, and setting it is someone else's job.
 */
import { IconAlertTriangle, IconFileCode } from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Plan, PlanStaleness } from "@byconvo/core/plans";
import {
  centerOn,
  fitViewport,
  layoutPlanGraph,
  NODE_HEIGHT,
  panBy,
  zoomAt,
} from "../functions/plan-graph.functions";
import {
  annotationsForNode,
  isBrokenAnchor,
  nodeStatus,
  statusLabel,
} from "../functions/plans-pane.functions";
import { setViewport } from "../adapters/plans-pane.store";
import { KIND_TONE } from "./plan-node-tone";
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

  const noteCount = (nodeId: string) =>
    annotationsForNode(plan.annotations, nodeId).length;

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
              className="fill-muted-foreground text-[0.625rem] font-medium tracking-widest uppercase"
            >
              {lane.label}
            </text>
          ))}

          {layout.edges.map((routed) => (
            <g key={routed.edge.id}>
              <path
                d={routed.path}
                fill="none"
                markerEnd="url(#plan-arrow)"
                className={cn(
                  "stroke-border",
                  routed.edge.kind === "event" && "[stroke-dasharray:4_4]"
                )}
                strokeWidth={1.5}
              />
              {routed.labelText !== "" && (
                <text
                  x={routed.label.x}
                  y={routed.label.y}
                  textAnchor={routed.labelAnchor}
                  className="fill-muted-foreground text-[0.625rem]"
                  // A label sitting on the wire needs the wire cleared behind it.
                  paintOrder="stroke"
                  strokeWidth={6}
                  stroke="var(--pane)"
                >
                  {/* Clipped to fit the gutter; the whole of it is on hover. */}
                  <title>{routed.edge.label}</title>
                  {routed.labelText}
                </text>
              )}
            </g>
          ))}

          {layout.nodes.map(({ node, x, y, width, height }) => {
            const status = nodeStatus(node.id, staleness);
            const broken = status !== null && isBrokenAnchor(status);
            const notes = noteCount(node.id);
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
                    "plan-node group flex w-full flex-col justify-center gap-0.5 rounded-xl border px-3 py-2 text-left transition-shadow",
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
                    <span
                      className={cn(
                        "text-[0.625rem] font-medium tracking-wide uppercase",
                        KIND_TONE[node.kind]
                      )}
                    >
                      {node.kind}
                    </span>
                    {broken && (
                      <IconAlertTriangle className="size-3 text-destructive" />
                    )}
                    <span className="flex-1" />
                    {notes > 0 && (
                      <span className="rounded-full bg-elevate-strong px-1.5 text-[0.625rem] text-muted-foreground">
                        {notes}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[0.8125rem] font-medium">
                    {node.label}
                  </div>
                  {node.summary !== "" ? (
                    <div className="line-clamp-2 text-[0.6875rem] leading-tight text-muted-foreground">
                      {node.summary}
                    </div>
                  ) : (
                    node.anchor !== null && (
                      <div className="flex items-center gap-1 truncate text-[0.6875rem] text-muted-foreground">
                        <IconFileCode className="size-3 shrink-0" />
                        <span className="truncate">
                          {node.anchor.filePath.split("/").pop()}
                        </span>
                      </div>
                    )
                  )}
                </button>
              </foreignObject>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
