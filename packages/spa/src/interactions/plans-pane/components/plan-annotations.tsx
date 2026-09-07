/**
 * The analysis as a list, beside the drawing.
 *
 * One row per step of the flow, in the order the graph draws them — including
 * the steps nobody has written about, because this list is the drawing's index
 * and a step missing from it would read as a step missing from the analysis.
 *
 * The two kinds of note are told apart by their ground rather than by a marker
 * or by weaker ink. A finding the analysis left is the document: prose on the
 * pane itself. A note the reader added sits in a well beneath it, signed, which
 * reads as something laid on top of the finding — which is what it is.
 *
 * Notes carry their code link above the text, the way a step carries its own
 * under its heading, so which link belongs to which body is never a guess.
 *
 * Clicking a row is the list-to-graph half of the sync; a file link jumps to the
 * code, at wherever that code now lives.
 */
import { IconAlertTriangle, IconTrash } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Plan, PlanAnnotation, PlanStaleness } from "@reviewer/core/plans";
import { Button } from "@/components/ui/button";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import {
  annotationTarget,
  isBrokenAnchor,
  nodeTarget,
  planOutline,
  sameTarget,
  splitPath,
  statusLabel,
} from "../functions/plans-pane.functions";
import { KIND_LABEL, KIND_PILL, KIND_PILL_SHAPE } from "./plan-node-tone";
import type {
  AnnotationTarget,
  OutlineGroup,
} from "../interfaces/plans-pane.interfaces";
import { cn } from "@/lib/utils";

/**
 * Note prose, rendered as markdown — agents write in backticks and emphasis, and
 * a note showing its own source is a note nobody can read. A note that makes
 * several points arrives as a numbered list (see the reviewer-plans skill), which
 * `.plan-note` sets as the note's normal shape rather than as an aside.
 *
 * Full-strength ink, not muted: a finding is what the reader came here for, and
 * the only thing set quieter than it is the summary of a step nobody wrote about.
 */
function NoteBody({ body }: { body: string }) {
  return (
    <div className="markdown plan-note min-w-0 text-[0.8125rem] text-foreground">
      <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown>
    </div>
  );
}

/**
 * The jump to code, set the way the app's own path trail sets one: sans with the
 * file's type icon, and no mono. Mono is for code, and a path is a name — in mono
 * at this size it read as a string of data rather than as a place.
 *
 * One weight and one tone for the whole path, the note's own. Emphasis inside a
 * path is a distinction nobody asked for: the icon already says which file this
 * is, and a bolded tail only breaks the line into two things to read.
 *
 * The folders are still the part that gives when there is no room, so a narrow
 * pane clips `packages/spa/src/…` and never the filename and line, which are the
 * only parts that tell two links apart.
 */
function CodeLink({
  target,
  onOpen,
}: {
  target: AnnotationTarget;
  onOpen: () => void;
}) {
  const broken = isBrokenAnchor(target.status);
  const { folders, name } = splitPath(target.filePath);
  return (
    <button
      type="button"
      title={statusLabel(target.status)}
      className={cn(
        "-mx-1.5 flex max-w-full min-w-0 items-center gap-1.5 self-start rounded-md px-1.5 py-1 text-left text-xs hover:bg-elevate",
        broken ? "text-destructive" : "text-foreground"
      )}
      onClick={onOpen}
    >
      {broken ? (
        <IconAlertTriangle className="size-4 shrink-0" />
      ) : (
        <FileTypeIcon path={target.filePath} className="size-4 shrink-0" />
      )}
      <span className="flex min-w-0 items-baseline">
        {folders !== "" && <span className="min-w-0 truncate">{folders}</span>}
        <span className="shrink-0 tabular-nums">
          {name}
          {target.line !== null && `:${target.line}`}
        </span>
      </span>
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
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      className={cn(
        "flex flex-col gap-1.5",
        mine && "rounded-lg bg-elevate p-2.5"
      )}
    >
      {mine && (
        <div className="flex items-center gap-1.5">
          <div className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
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
      {target !== null && <CodeLink target={target} onOpen={onOpen} />}
      <NoteBody body={annotation.body} />
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
        // The lightest thing that separates siblings: a hairline, not a card.
        "border-t border-frame-border first:border-t-0",
        selected && "bg-elevate"
      )}
    >
      {/* The whole row is the target, not just its heading: everything in here
          is about one step, so anywhere in it should light that step up on the
          drawing. The parts that do something of their own — a file link, the
          remove button — do it and then let the click carry on up to here. */}
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        className="w-full cursor-default px-4 py-3.5 text-left"
        onClick={pick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            pick();
          }
        }}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            {group.kind === null ? (
              <div className="text-sm font-medium text-muted-foreground">
                On the analysis
              </div>
            ) : (
              <>
                <div className={cn(KIND_PILL_SHAPE, KIND_PILL[group.kind])}>
                  {KIND_LABEL[group.kind]}
                </div>
                <div className="min-w-0 flex-1 truncate text-sm font-medium">
                  {group.label}
                </div>
              </>
            )}
          </div>

          {/* A step nobody wrote about still says what it does, so the row earns
            its place rather than reading as an empty heading. */}
          {group.annotations.length === 0 && group.summary !== "" && (
            <p className="text-[0.8125rem] leading-relaxed text-pretty text-muted-foreground">
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
            <div className="flex flex-col gap-3">
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
                      target !== null &&
                      onOpenCode(target.filePath, target.line)
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
        </div>
      </div>
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
      <p className="px-6 py-8 text-center text-sm text-pretty text-muted-foreground">
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
