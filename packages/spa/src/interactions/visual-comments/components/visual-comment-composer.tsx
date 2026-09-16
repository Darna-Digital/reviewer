/**
 * The note taken on a picked element, hung off the dot left where it was
 * clicked.
 *
 * It is one surface for two things — the words, and the style tweaks tried on
 * the element while writing them — because they are one comment: "this should
 * be darker" and the exact darker it should be. Either alone is enough to send.
 * Shown with the shot of the element rather than only its selector: by the time
 * the comment is written the page may have scrolled or re-rendered, and the
 * thumbnail is the record of what was actually being pointed at.
 */
import { IconTrash } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useListEditing } from "@/hooks/use-list-editing";
import type { VisualCommentDraft } from "@/interactions/browser-pane/interfaces/browser-pane.interfaces";
import type { StyleChange } from "@reviewer/core/visual-comments";
import {
  toStyleChanges,
  type StyleEdits,
} from "../functions/visual-style.functions";
import { StyleInspector } from "./style-inspector";

export function VisualCommentComposer({
  draft,
  anchor,
  onStyle,
  onSubmit,
  onCancel,
  onDelete,
}: {
  draft: VisualCommentDraft;
  /** The dot the popover hangs off; null until it has mounted. */
  anchor: HTMLElement | null;
  /** A live edit for the page — `null` puts the property back as it was. */
  onStyle: (property: string, value: string | null) => void;
  onSubmit: (
    body: string,
    changes: ReadonlyArray<StyleChange>
  ) => Promise<void>;
  onCancel: () => void;
  /** Only a re-opened comment can be deleted; a fresh draft is cancelled. */
  onDelete?: () => Promise<void>;
}) {
  const [body, setBody] = useState(draft.existing?.body ?? "");
  const [edits, setEdits] = useState<StyleEdits>(() =>
    Object.fromEntries(
      (draft.existing?.styleChanges ?? []).map((change) => [
        change.property,
        change.to,
      ])
    )
  );
  // A re-opened comment's tweaks go back onto the element as the composer
  // opens, so what is seen is what was saved — not what a reload undid.
  useEffect(() => {
    for (const [property, value] of Object.entries(edits)) {
      onStyle(property, value);
    }
    // Once, when the draft opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement | null>(null);
  // The same list keys as everywhere else the app is typed into — a note on a
  // page is usually several things about it, not one.
  const editList = useListEditing({
    textareaRef: field,
    text: body,
    setText: setBody,
  });

  const changes = toStyleChanges(draft.styles, edits);
  const canSubmit = (body.trim().length > 0 || changes.length > 0) && !busy;

  const edit = (property: string, value: string) => {
    setEdits((current) => ({ ...current, [property]: value }));
    onStyle(property, value);
  };
  const reset = (property: string) => {
    setEdits((current) => {
      const { [property]: _dropped, ...rest } = current;
      return rest;
    });
    onStyle(property, null);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onSubmit(body.trim(), changes);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      open={anchor !== null}
      onOpenChange={(open, details) => {
        if (open) return;
        // A click on the pane's chrome, or in the page, is not a change of
        // mind: the draft only goes when it is sent, cancelled or escaped.
        if (details.reason === "outside-press") {
          details.cancel();
          return;
        }
        onCancel();
      }}
    >
      <PopoverContent
        anchor={anchor}
        side="left"
        align="start"
        sideOffset={10}
        collisionPadding={8}
        initialFocus={field}
        finalFocus={false}
        className="flex max-h-(--available-height) w-[25rem] flex-col gap-0 overflow-hidden p-0"
      >
        <div className="flex items-start gap-2 border-b border-frame-border p-2.5">
          {draft.screenshot !== null && (
            <img
              src={draft.screenshot}
              alt=""
              className="max-h-12 w-12 shrink-0 rounded-md border border-frame-border object-cover object-left-top"
            />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{draft.label}</div>
            <div
              className="truncate font-mono text-[0.6875rem] text-muted-foreground"
              title={draft.selector}
            >
              {draft.selector}
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
          <Textarea
            ref={field}
            value={body}
            placeholder="What should change here?"
            className="min-h-14 text-sm"
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
                return;
              }
              editList(event);
            }}
          />
          <StyleInspector
            computed={draft.styles}
            edits={edits}
            onEdit={edit}
            onReset={reset}
          />
        </div>
        <div className="flex items-center gap-1.5 border-t border-frame-border p-2">
          <span className="flex-1 truncate text-xs text-muted-foreground">
            {changes.length === 0
              ? "Edit styles to try a change live"
              : `${changes.length} style change${changes.length === 1 ? "" : "s"}`}
          </span>
          {onDelete !== undefined && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Delete comment"
              title="Delete comment"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => void onDelete()}
            >
              <IconTrash className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canSubmit} onClick={() => void submit()}>
            {draft.existing === null ? "Comment" : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
