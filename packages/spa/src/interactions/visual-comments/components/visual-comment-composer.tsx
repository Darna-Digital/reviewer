/**
 * The note taken on a picked element, over the page it was picked from.
 *
 * Shown with the shot of the element rather than only its selector: by the time
 * the comment is written the page may have scrolled or re-rendered, and the
 * thumbnail is the record of what was actually being pointed at.
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { VisualCommentDraft } from "@/interactions/browser-pane/interfaces/browser-pane.interfaces";

export function VisualCommentComposer({
  draft,
  onSubmit,
  onCancel,
}: {
  draft: VisualCommentDraft;
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => field.current?.focus(), []);

  const submit = async () => {
    const text = body.trim();
    if (text.length === 0 || busy) return;
    setBusy(true);
    try {
      await onSubmit(text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="absolute inset-x-2 bottom-2 z-10 rounded-xl border border-frame-border bg-popover p-2 shadow-lg">
      <div className="flex items-start gap-2">
        {draft.screenshot !== null && (
          <img
            src={draft.screenshot}
            alt=""
            className="max-h-16 w-16 shrink-0 rounded-md border border-frame-border object-cover object-left-top"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium">{draft.label}</div>
          <div className="truncate font-mono text-[0.6875rem] text-muted-foreground">
            {draft.selector}
          </div>
        </div>
      </div>
      <Textarea
        ref={field}
        value={body}
        placeholder="What should change here?"
        className="mt-2 min-h-16 text-sm"
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            void submit();
          }
        }}
      />
      <div className="mt-2 flex justify-end gap-1.5">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={body.trim().length === 0 || busy}
          onClick={() => void submit()}
        >
          Comment
        </Button>
      </div>
    </div>
  );
}
