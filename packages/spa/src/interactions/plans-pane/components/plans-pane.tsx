/**
 * PlansPane — an analysis, split beside the app canvas.
 *
 * The pane is a window-level surface like the browser beside it: it belongs to
 * the window rather than to a route, so it survives navigating around the app
 * and can send you to a file without losing what you were reading.
 *
 * It reads analyses; it does not compose them. Asking for one is a session in
 * analysis mode, so the "+" beside the picker hands over to the composer every
 * other session starts from rather than keeping a second one here.
 *
 * Three things share it — the picker, the drawing, and the notes — and the
 * selection in the store is the only thing they have in common. Everything they
 * decide (where a node sits, where a note now points, whether the analysis has
 * aged out) comes from `../functions`.
 */
import {
  IconAlertTriangle,
  IconChevronDown,
  IconPlus,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { usePanelSize } from "@/components/layout/use-panel-size";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NEW_SESSION,
  setChatMode,
} from "@/interactions/chats/adapters/chat-mode.store";
import { NEW_CHAT_DRAFT, setDraft } from "@/lib/composer-drafts";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";
import { useOpenInEditor } from "../adapters/open-in-editor.adapter";
import {
  clearSelection,
  focusAnnotation,
  followLatestPlan,
  openPlan,
  selectNode,
  usePlansPane,
} from "../adapters/plans-pane.store";
import {
  usePlan,
  usePlanActions,
  usePlans,
} from "../adapters/plans.hook.adapter";
import {
  nodeTarget,
  stalenessMessage,
} from "../functions/plans-pane.functions";
import { PlanAnnotations } from "./plan-annotations";
import { PlanGraph } from "./plan-graph";

/** The graph never shrinks below this, however far the notes are dragged up. */
const GRAPH_FLOOR = 160;

const TONE_STYLES = {
  ok: "text-muted-foreground",
  moved: "text-amber-600 dark:text-amber-500",
  stale: "text-destructive",
} as const;

export function PlansPane() {
  const prefs = useUiPrefs();
  const pane = usePlansPane();
  const navigate = useNavigate();
  const openInEditor = useOpenInEditor();

  const plans = usePlans();
  const view = usePlan(pane.planId);
  const actions = usePlanActions();

  const frame = useRef<HTMLElement | null>(null);

  // The pane's own width is dragged by a handle in the window frame, so both
  // read the same variable; the notes' height is dragged here. Neither is React
  // state — a drag that re-rendered this pane would relay out the whole graph
  // on every pointer frame. See `usePanelSize`.
  const plansPaneWidth = usePanelSize("plans-w", prefs.plansPaneWidth, "width");
  const notes = usePanelSize("plans-notes-h", prefs.plansNotesHeight, "height");

  const summaries = plans.data ?? [];
  const plan = view.data?.plan;
  const staleness = view.data?.staleness;

  // The pane opens on the most recently touched analysis rather than on an
  // empty canvas, and keeps up with one an agent finishes while it is open —
  // the list is polled and already sorted that way.
  useEffect(() => {
    const newest = plans.data?.[0];
    if (newest !== undefined) followLatestPlan(newest.id);
  }, [plans.data]);

  /**
   * Ask for an analysis: a new session, in analysis mode, with the question
   * already typed if there is one to carry over. The composer there is the one
   * that picks the agent, the model and how much rope it gets, which is why the
   * pane no longer has one of its own.
   */
  const newAnalysis = (question?: string) => {
    setChatMode(NEW_SESSION, "analysis");
    if (question !== undefined && question !== "") {
      setDraft(NEW_CHAT_DRAFT, question);
    }
    void navigate({ to: "/modes/agent-session", search: { new: true } });
  };

  const removePlan = async (id: string) => {
    try {
      await actions.remove(id);
      if (id === pane.planId) openPlan(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not delete the analysis"
      );
    }
  };

  const openNode = (nodeId: string) => {
    if (plan === undefined) return;
    const target = nodeTarget(plan, nodeId, staleness);
    if (target === null) return;
    openInEditor(target.filePath, target.line);
  };

  const message = stalenessMessage(staleness);

  return (
    <aside
      ref={frame}
      aria-label="Analysis"
      className="plans-pane flex min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-frame-border"
      // Same variable the frame's handle drags — see `usePanelSize`.
      style={plansPaneWidth.style}
    >
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-frame-border px-1.5">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-7 max-w-56 min-w-0 justify-start gap-1 rounded-lg px-2 text-xs"
              />
            }
          >
            <span className="truncate">{plan?.title ?? "No analysis yet"}</span>
            <IconChevronDown className="size-3.5 shrink-0 opacity-60" />
          </PopoverTrigger>
          {/* Not the sheet's own `gap-4` — that is for stacked sections — but
              not flush either: a hair between the rows is what keeps two
              analyses from reading as one entry with a second line. */}
          <PopoverContent align="start" className="w-72 gap-0.5 p-1">
            {summaries.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                Nothing analysed yet.
              </div>
            ) : (
              // Deleting one is the picker's job now: it is the only place every
              // analysis is named, so it is the only place the choice of which
              // to throw away can actually be made.
              summaries.map((summary) => (
                <div
                  key={summary.id}
                  className={cn(
                    "group/row flex items-center gap-1 rounded-lg pr-1 hover:bg-elevate",
                    summary.id === pane.planId && "bg-elevate-strong"
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 flex-col items-start gap-0.5 px-2 py-1.5 text-left"
                    onClick={() => openPlan(summary.id)}
                  >
                    <span className="w-full truncate text-[0.8125rem]">
                      {summary.title}
                    </span>
                    <span className="text-[0.6875rem] text-muted-foreground">
                      {summary.nodeCount} steps
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${summary.title}`}
                    className="shrink-0 text-muted-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
                    onClick={() => void removePlan(summary.id)}
                  >
                    <IconTrash className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="New analysis"
                className="shrink-0 rounded-lg text-muted-foreground"
                onClick={() => newAnalysis()}
              />
            }
          >
            <IconPlus className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="bottom">New analysis</TooltipContent>
        </Tooltip>
        <div className="flex-1" />
      </div>

      {plan === undefined ? (
        // Only once there is genuinely nothing to show: an analysis still on its
        // way back would otherwise be announced as an empty pane.
        summaries.length === 0 && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="text-sm font-medium">Nothing analysed yet</p>
            <p className="text-sm text-pretty text-muted-foreground">
              An agent reads the code and draws the flow — front to back — with
              notes at the places worth knowing about.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-1"
              onClick={() => newAnalysis()}
            >
              <IconPlus className="size-4" />
              Ask for an analysis
            </Button>
          </div>
        )
      ) : (
        <>
          {message !== null && message.tone !== "ok" && (
            <div
              className={cn(
                "flex items-start gap-1.5 border-b border-frame-border px-3 py-1.5 text-[0.6875rem]",
                TONE_STYLES[message.tone]
              )}
            >
              {message.tone === "stale" ? (
                <IconAlertTriangle className="mt-px size-3.5 shrink-0" />
              ) : (
                <IconRefresh className="mt-px size-3.5 shrink-0" />
              )}
              <span className="flex-1">{message.text}</span>
              {message.tone === "stale" && (
                <button
                  type="button"
                  className="shrink-0 font-medium underline underline-offset-2"
                  // A rerun is the same question against today's code, so it
                  // arrives already typed rather than as a blank box.
                  onClick={() => newAnalysis(plan.question)}
                >
                  Rerun
                </button>
              )}
            </div>
          )}

          <PlanGraph
            plan={plan}
            staleness={staleness}
            viewport={pane.viewport}
            selectedNodeId={pane.selectedNodeId}
            focusRequest={pane.focusRequest}
            onSelectNode={(nodeId) =>
              nodeId === null ? clearSelection() : selectNode(nodeId)
            }
            onOpenNode={openNode}
          />

          <ResizeHandle
            orientation="row"
            label="Resize notes"
            value={notes.current}
            min={72}
            // Bounded by the pane rather than the window: the frame, the window
            // bar and the pane's own chrome are all above it, so a viewport
            // figure would let the notes eat the graph entirely.
            max={() =>
              Math.max(72, (frame.current?.clientHeight ?? 0) - GRAPH_FLOOR)
            }
            direction={-1}
            onResize={notes.onResize}
            onResizeEnd={(plansNotesHeight) => setUiPrefs({ plansNotesHeight })}
          />
          <div
            className="plans-notes min-h-0 shrink-0 overflow-y-auto border-t border-frame-border"
            style={notes.style}
          >
            <PlanAnnotations
              plan={plan}
              staleness={staleness}
              selectedNodeId={pane.selectedNodeId}
              selectedAnnotationId={pane.selectedAnnotationId}
              onFocus={focusAnnotation}
              onOpenCode={openInEditor}
              onRemove={(annotationId) =>
                void actions.removeAnnotation(plan.id, annotationId)
              }
            />
          </div>
        </>
      )}
    </aside>
  );
}
