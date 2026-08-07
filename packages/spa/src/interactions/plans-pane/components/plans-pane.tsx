/**
 * PlansPane — an analysis, split beside the app canvas.
 *
 * The pane is a window-level surface like the browser beside it: it belongs to
 * the window rather than to a route, so it survives navigating around the app
 * and can send you to a file without losing what you were reading.
 *
 * Three things share it — the picker, the drawing, and the notes — and the
 * selection in the store is the only thing they have in common. Everything they
 * decide (where a node sits, where a note now points, whether the analysis has
 * aged out) comes from `../functions`.
 */
import {
  IconAlertTriangle,
  IconChevronDown,
  IconDeviceFloppy,
  IconMessagePlus,
  IconPlus,
  IconRefresh,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useChatsActions } from "@/interactions/chats/adapters/chats.hook.adapter";
import { ChatComposer } from "@/interactions/chats/components/chat-composer";
import { preferredChatModel } from "@/interactions/chats/functions/chat-model.functions";
import type {
  ChatImage,
  ChatSettings,
} from "@/interactions/chats/interfaces/chats.interfaces";
import type { ChatModelCatalog } from "@byconvo/core/chats";
import { ANALYSIS_DRAFT, setDraft } from "@/lib/chat-drafts";
import { useChatModels, useRepo } from "@/lib/queries";
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
  buildAnalysisPrompt,
  buildAnalysisTitle,
  buildPlanReviewPrompt,
  buildPlanReviewTitle,
  nodeTarget,
  reviewAnnotations,
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

function ChromeButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={active}
            disabled={disabled}
            onClick={onClick}
            className={cn(
              "rounded-lg text-muted-foreground",
              active === true && "bg-elevate-strong text-foreground"
            )}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Asking an agent for an analysis — the pane's only way to make a new one.
 *
 * Deliberately the new-thread page's own layout and composer rather than a
 * bespoke form: asking for an analysis *is* starting a session, so the thing
 * that picks the agent, the model and how much rope it gets should be the
 * control that does that everywhere else — down to the draft surviving a
 * navigation away and back.
 */
function NewAnalysis({
  settings,
  onSettingsChange,
  catalog,
  onAsk,
}: {
  settings: ChatSettings;
  onSettingsChange: (patch: Partial<ChatSettings>) => void;
  catalog: ChatModelCatalog | undefined;
  onAsk: (question: string, images: ReadonlyArray<ChatImage>) => Promise<void>;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
        <p className="text-sm font-medium">Ask for an analysis</p>
        <p className="text-sm text-pretty text-muted-foreground">
          An agent reads the code and draws the flow — front to back — with
          notes at the places worth knowing about.
        </p>
      </div>
      <div className="mx-auto w-full max-w-3xl shrink-0 px-3 pb-3">
        <ChatComposer
          draftKey={ANALYSIS_DRAFT}
          settings={settings}
          onSettingsChange={onSettingsChange}
          catalog={catalog}
          onSend={onAsk}
          running={false}
          placeholder="How is a new branch created?"
        />
      </div>
    </div>
  );
}

export function PlansPane() {
  const prefs = useUiPrefs();
  const pane = usePlansPane();
  const repo = useRepo();
  const navigate = useNavigate();
  const openInEditor = useOpenInEditor();

  const plans = usePlans();
  const view = usePlan(pane.planId);
  const actions = usePlanActions();
  const chatActions = useChatsActions();
  const chatModels = useChatModels();

  const frame = useRef<HTMLElement | null>(null);
  const [composing, setComposing] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [picking, setPicking] = useState(false);
  const [overrides, setOverrides] = useState<Partial<ChatSettings>>({});

  // Seeded the way the new-thread page seeds it, so the pane opens on the same
  // agent and model the composer would offer anywhere else.
  const defaults = chatModels.data?.defaults;
  const preferred = preferredChatModel(
    chatModels.data,
    prefs.chatModelFavorites
  );
  const settings: ChatSettings = {
    provider: overrides.provider ?? preferred?.provider ?? "claude",
    model: overrides.model ?? preferred?.id ?? "",
    effort: overrides.effort ?? defaults?.effort ?? "high",
    access: overrides.access ?? defaults?.access ?? "fullAccess",
    // An analysis has to read the code and then POST the result back, so it
    // needs the mode that can run a command — plan mode is read-only.
    mode: overrides.mode ?? "build",
  };

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
   * Hand work to a session with the agent the composer is set to. Every handoff
   * the pane makes goes through here, so the pick applies to a rerun and to the
   * notes as well as to the first analysis.
   */
  const handOff = async (
    title: string,
    prompt: string,
    images: ReadonlyArray<ChatImage> = []
  ) => {
    const started = await chatActions.startWithTitle(
      settings,
      repo.data?.currentBranch ?? "",
      title,
      prompt,
      images
    );
    if (started === null) return null;
    void navigate({
      to: "/modes/code/chats/$chatId",
      params: { chatId: started.id },
    });
    return started.id;
  };

  const askForAnalysis = async (
    question: string,
    images: ReadonlyArray<ChatImage>
  ) => {
    try {
      const chatId = await handOff(
        buildAnalysisTitle(question),
        buildAnalysisPrompt(question),
        images
      );
      if (chatId === null) return;
      setComposing(false);
      toast.success("Working the analysis out — it appears here when it lands");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not start the analysis"
      );
      // The composer keeps the draft only when the send is rejected.
      throw error;
    }
  };

  const addNote = async () => {
    const body = noteBody.trim();
    if (plan === undefined || body.length === 0) return;
    const anchor =
      pane.selectedNodeId === null
        ? null
        : (plan.nodes.find((node) => node.id === pane.selectedNodeId)?.anchor ??
          null);
    try {
      await actions.annotate(plan.id, {
        nodeId: pane.selectedNodeId,
        body,
        anchor:
          anchor === null
            ? null
            : { filePath: anchor.filePath, line: anchor.line },
      });
      setNoteBody("");
      setPicking(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not save the note"
      );
    }
  };

  /**
   * Saving freezes the analysis. The notes the reader left go with it — they
   * were the conversation about the finding, not the finding — so they are
   * handed to an agent first if there are any, which is the only chance to act
   * on them.
   */
  const saveAnalysis = async () => {
    if (plan === undefined) return;
    const notes = reviewAnnotations(plan);
    try {
      if (notes.length > 0) {
        await handOff(
          buildPlanReviewTitle(notes.length),
          buildPlanReviewPrompt(plan, notes)
        );
      }
      await actions.save(plan.id);
      toast.success(
        notes.length > 0
          ? `Saved — ${notes.length} note${notes.length === 1 ? "" : "s"} handed over`
          : "Analysis saved"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not save the analysis"
      );
    }
  };

  const removePlan = async () => {
    if (plan === undefined) return;
    try {
      await actions.remove(plan.id);
      openPlan(null);
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
      style={{ width: prefs.plansPaneWidth }}
    >
      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-frame-border px-1.5">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="h-7 min-w-0 flex-1 justify-start gap-1 rounded-lg px-2 text-xs"
              />
            }
          >
            <span className="truncate">{plan?.title ?? "No analysis yet"}</span>
            <IconChevronDown className="size-3.5 shrink-0 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-1">
            {summaries.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                Nothing analysed yet.
              </div>
            ) : (
              summaries.map((summary) => (
                <button
                  key={summary.id}
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left hover:bg-elevate",
                    summary.id === pane.planId && "bg-elevate-strong"
                  )}
                  onClick={() => openPlan(summary.id)}
                >
                  <span className="w-full truncate text-[0.8125rem]">
                    {summary.title}
                  </span>
                  <span className="text-[0.6875rem] text-muted-foreground">
                    {summary.nodeCount} steps
                    {summary.savedAt === null ? " · draft" : " · saved"}
                  </span>
                </button>
              ))
            )}
          </PopoverContent>
        </Popover>
        <ChromeButton
          label="New analysis"
          active={composing}
          onClick={() => setComposing((open) => !open)}
        >
          <IconPlus className="size-4" />
        </ChromeButton>
        <ChromeButton
          label="Add a note"
          active={picking}
          disabled={plan === undefined}
          onClick={() => setPicking((open) => !open)}
        >
          <IconMessagePlus className="size-4" />
        </ChromeButton>
        <ChromeButton
          label="Save analysis"
          disabled={plan === undefined}
          onClick={() => void saveAnalysis()}
        >
          <IconDeviceFloppy className="size-4" />
        </ChromeButton>
        <ChromeButton
          label="Delete analysis"
          disabled={plan === undefined}
          onClick={() => void removePlan()}
        >
          <IconTrash className="size-4" />
        </ChromeButton>
        <ChromeButton
          label="Close analysis pane"
          onClick={() => setUiPrefs({ plansPaneOpen: false })}
        >
          <IconX className="size-4" />
        </ChromeButton>
      </div>

      {composing || plan === undefined ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NewAnalysis
            settings={settings}
            onSettingsChange={(patch) =>
              setOverrides((prev) => ({ ...prev, ...patch }))
            }
            catalog={chatModels.data}
            onAsk={askForAnalysis}
          />
        </div>
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
                  onClick={() => {
                    // A rerun is the same question against today's code, so it
                    // arrives already typed rather than as a blank box.
                    if (plan.question !== "") {
                      setDraft(ANALYSIS_DRAFT, plan.question);
                    }
                    setComposing(true);
                  }}
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

          {picking && (
            <div className="border-t border-frame-border p-2">
              <Textarea
                value={noteBody}
                autoFocus
                placeholder={
                  pane.selectedNodeId === null
                    ? "A note on this analysis…"
                    : "A note on the selected step…"
                }
                className="min-h-14 text-sm"
                onChange={(event) => setNoteBody(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setPicking(false);
                  if (
                    event.key === "Enter" &&
                    (event.metaKey || event.ctrlKey)
                  ) {
                    event.preventDefault();
                    void addNote();
                  }
                }}
              />
              <div className="mt-1.5 flex justify-end gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPicking(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={noteBody.trim().length === 0}
                  onClick={() => void addNote()}
                >
                  Note
                </Button>
              </div>
            </div>
          )}

          <ResizeHandle
            orientation="row"
            label="Resize notes"
            value={prefs.plansNotesHeight}
            min={72}
            // Bounded by the pane rather than the window: the frame, the window
            // bar and the pane's own chrome are all above it, so a viewport
            // figure would let the notes eat the graph entirely.
            max={() =>
              Math.max(72, (frame.current?.clientHeight ?? 0) - GRAPH_FLOOR)
            }
            direction={-1}
            onResize={(plansNotesHeight) => setUiPrefs({ plansNotesHeight })}
          />
          <div
            className="min-h-0 shrink-0 overflow-y-auto border-t border-frame-border"
            style={{ height: prefs.plansNotesHeight }}
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
