/**
 * The analysis as a list, beside the drawing.
 *
 * One row per step of the flow, in the order the graph draws them — including
 * the steps nobody has written about, because this list is the drawing's index
 * and a step missing from it would read as a step missing from the analysis.
 *
 * The two kinds of note are told apart by weight rather than by a marker. A
 * finding the analysis left is the document: plain text, no container. A note
 * the reader added sits in a well beneath it, which reads as something laid on
 * top of the finding — which is what it is, and what saving clears.
 *
 * Clicking a row is the list-to-graph half of the sync; a file link jumps to the
 * code, at wherever that code now lives.
 */
import {
  IconAlertTriangle,
  IconArrowNarrowRight,
  IconFileCode,
  IconTrash,
} from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import type { Plan, PlanAnnotation, PlanStaleness } from "@byconvo/core/plans";
import { Button } from "@/components/ui/button";
import {
  annotationTarget,
  isBrokenAnchor,
  nodeTarget,
  planOutline,
  sameTarget,
  statusLabel,
} from "../functions/plans-pane.functions";
import { KIND_TONE } from "./plan-node-tone";
import type {
  AnnotationTarget,
  OutlineGroup,
} from "../interfaces/plans-pane.interfaces";
import { cn } from "@/lib/utils";

/**
 * The jump to code. It wears a file glyph because that is what it opens, and it
 * shrinks to its own text — a hover band running the width of the pane would
 * suggest the whole row is the link when only the path is.
 */
function CodeLink({
  target,
  onOpen,
}: {
  target: AnnotationTarget;
  onOpen: () => void;
}) {
  const broken = isBrokenAnchor(target.status);
  return (
    <button
      type="button"
      title={statusLabel(target.status)}
      className={cn(
        "group/link -mx-1 flex max-w-full min-w-0 shrink-0 items-center gap-1 self-start rounded px-1 py-0.5 text-left text-[0.6875rem] hover:bg-elevate",
        broken
          ? "text-destructive"
          : "text-muted-foreground hover:text-foreground"
      )}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      {broken ? (
        <IconAlertTriangle className="size-3.5 shrink-0" />
      ) : (
        <IconFileCode className="size-3.5 shrink-0" />
      )}
      <span className="min-w-0 truncate font-mono tabular-nums group-hover/link:underline">
        {target.filePath}
        {target.line !== null && `:${target.line}`}
      </span>
      {target.status === "relocated" && (
        <IconArrowNarrowRight className="size-3.5 shrink-0 opacity-60" />
      )}
    </button>
  );
}

function Note({
  annotation,
  target,
  onSelect,
  onOpen,
  onRemove,
}: {
  annotation: PlanAnnotation;
  target: AnnotationTarget | null;
  onSelect: () => void;
  onOpen: () => void;
  onRemove: (() => void) | null;
}) {
  const mine = annotation.origin === "review";
  return (
    <div
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-1",
        mine && "rounded-lg bg-elevate p-2 pl-2.5"
      )}
    >
      {mine && (
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1 truncate text-[0.6875rem] font-medium text-foreground">
            {annotation.author}
          </div>
          {onRemove !== null && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove note"
              className="-my-1 size-6 shrink-0 text-muted-foreground"
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
            >
              <IconTrash className="size-3.5" />
            </Button>
          )}
        </div>
      )}
      <p
        className={cn(
          "text-[0.8125rem] leading-5 text-pretty whitespace-pre-wrap",
          mine ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {annotation.body}
      </p>
      {target !== null && <CodeLink target={target} onOpen={onOpen} />}
    </div>
  );
}

function Group({
  group,
  step,
  staleness,
  selected,
  onSelect,
  onOpenCode,
  onRemove,
}: {
  group: OutlineGroup;
  /** Where the step itself lives, shown once at the head of its notes. */
  step: AnnotationTarget | null;
  staleness: PlanStaleness | undefined;
  selected: boolean;
  onSelect: (annotationId: string | null) => void;
  onOpenCode: (filePath: string, line: number | null) => void;
  onRemove: (annotationId: string) => void;
}) {
  const row = useRef<HTMLLIElement | null>(null);

  // Selecting a step on the graph scrolls its row into view here — the same
  // move the graph makes in the other direction.
  useEffect(() => {
    if (selected) {
      row.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selected]);

  const pick = () => onSelect(group.annotations[0]?.id ?? null);

  return (
    <li
      ref={row}
      className={cn(
        "flex flex-col gap-1.5 px-3 py-2.5",
        // The lightest thing that separates siblings: a hairline, not a card.
        "border-t border-frame-border first:border-t-0",
        selected && "bg-elevate"
      )}
    >
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        className="flex w-full cursor-default items-center gap-1.5"
        onClick={pick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            pick();
          }
        }}
      >
        {group.kind === null ? (
          <div className="text-[0.625rem] font-medium tracking-wide text-muted-foreground uppercase">
            On the analysis
          </div>
        ) : (
          <>
            <div
              className={cn(
                "shrink-0 text-[0.625rem] font-medium tracking-wide uppercase",
                KIND_TONE[group.kind]
              )}
            >
              {group.kind}
            </div>
            <div className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium">
              {group.label}
            </div>
          </>
        )}
        {group.annotations.length > 0 && (
          <div className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
            {group.annotations.length}
          </div>
        )}
      </div>

      {/* A step nobody wrote about still says what it does, so the row earns
          its place rather than reading as an empty heading. */}
      {group.annotations.length === 0 && group.summary !== "" && (
        <p className="text-[0.8125rem] leading-5 text-pretty text-muted-foreground">
          {group.summary}
        </p>
      )}

      {step !== null && (
        <CodeLink
          target={step}
          onOpen={() => onOpenCode(step.filePath, step.line)}
        />
      )}

      {group.annotations.length > 0 && (
        <div className="flex flex-col gap-2">
          {group.annotations.map((annotation) => {
            const target = annotationTarget(annotation, staleness);
            return (
              <Note
                key={annotation.id}
                annotation={annotation}
                // The step's own link is already at the head of the group.
                target={sameTarget(target, step) ? null : target}
                onSelect={() => onSelect(annotation.id)}
                onOpen={() =>
                  target !== null && onOpenCode(target.filePath, target.line)
                }
                onRemove={
                  annotation.origin === "review"
                    ? () => onRemove(annotation.id)
                    : null
                }
              />
            );
          })}
        </div>
      )}
    </li>
  );
}

export function PlanAnnotations({
  plan,
  staleness,
  selectedNodeId,
  selectedAnnotationId,
  onFocus,
  onOpenCode,
  onRemove,
}: {
  plan: Plan;
  staleness: PlanStaleness | undefined;
  selectedNodeId: string | null;
  selectedAnnotationId: string | null;
  onFocus: (annotationId: string | null, nodeId: string | null) => void;
  onOpenCode: (filePath: string, line: number | null) => void;
  onRemove: (annotationId: string) => void;
}) {
  const groups = planOutline(plan);

  if (groups.length === 0) {
    return (
      <p className="px-6 py-8 text-center text-[0.8125rem] text-pretty text-muted-foreground">
        This analysis has no steps yet.
      </p>
    );
  }

  return (
    <ul role="list">
      {groups.map((group) => (
        <Group
          key={group.nodeId ?? "loose"}
          group={group}
          step={
            group.nodeId === null
              ? null
              : nodeTarget(plan, group.nodeId, staleness)
          }
          staleness={staleness}
          selected={
            group.nodeId !== null &&
            (group.nodeId === selectedNodeId ||
              group.annotations.some(
                (annotation) => annotation.id === selectedAnnotationId
              ))
          }
          onSelect={(annotationId) => onFocus(annotationId, group.nodeId)}
          onOpenCode={onOpenCode}
          onRemove={onRemove}
        />
      ))}
    </ul>
  );
}
