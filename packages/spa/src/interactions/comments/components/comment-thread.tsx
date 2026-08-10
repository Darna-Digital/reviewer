/**
 * Shared review-comment UI — the composer, a single comment card, and the
 * thread container that stacks them. Used by both the diff surface (`DiffPane`)
 * and the single-file browse surface (`CodeView`) so inline comments look and
 * behave identically wherever they appear.
 *
 * Visually modelled on the Pierre / diffs.com comment threads: a soft rounded
 * card, round author avatars, name + relative timestamp, replies nested under
 * the opening comment, and a muted "Add reply… / Resolve" action row. Built on
 * the shadcn primitives and theme tokens so it adapts to light & dark.
 */
import { IconBrandGithub, IconCornerDownRight } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { AuthorAvatar } from "@/interactions/comments/components/author-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/relative-time";
import type { CommentSide, ReviewComment } from "@byconvo/core/comments";

/** Where a draft (or new) comment is anchored. */
export interface DraftLocation {
  readonly filePath: string;
  readonly side: CommentSide;
  readonly lineNumber: number;
}

/** Indent (avatar + gap) used to nest replies under the opening comment. */
const REPLY_INDENT = "ml-10";

/**
 * The card a thread and a draft both sit in. Capped at 400px rather than
 * stretched to the pane: a comment anchored to one line reads as a note pinned
 * beside that line, and a card that runs the width of the diff stops looking
 * pinned to anything. It also keeps the prose to a measure you can actually
 * scan — the same cap opencode puts on its line comments.
 */
const COMMENT_CARD =
  "my-2 mr-3 ml-12 w-full max-w-100 min-w-0 overflow-hidden rounded-md bg-surface-2 p-3 font-sans text-card-foreground shadow-raised";

export function CommentComposer({
  onCancel,
  onSubmit,
  autoFocus = true,
  submitLabel = "Comment",
  placeholder = "Leave a comment…",
  initialBody = "",
}: {
  onCancel: () => void;
  onSubmit: (body: string) => Promise<void>;
  autoFocus?: boolean;
  submitLabel?: string;
  placeholder?: string;
  initialBody?: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  const submit = async () => {
    if (body.trim().length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(body.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Textarea
        ref={ref}
        value={body}
        placeholder={placeholder}
        className="min-h-20 resize-none"
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
          if (e.key === "Escape") onCancel();
        }}
      />
      {/* Actions sit under the left edge of the field, submit first: the eye
          finishes the draft at the start of the last line, not out at the right
          margin, so that is where the button it wants should already be. */}
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            disabled={body.trim().length === 0 || busy}
            onClick={() => void submit()}
          >
            {busy ? "Saving…" : submitLabel}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <p className="min-w-0 flex-1 truncate type-meta text-destructive">
          {error}
        </p>
      </div>
    </div>
  );
}

function CommentCard({
  comment,
  editing,
  onEdit,
  onCancelEdit,
}: {
  comment: ReviewComment;
  editing: boolean;
  onEdit?: (body: string) => Promise<void>;
  onCancelEdit?: () => void;
}) {
  if (editing && onEdit !== undefined && onCancelEdit !== undefined) {
    return (
      <div className="flex gap-3">
        <AuthorAvatar author={comment.author} source={comment.source} />
        <div className="min-w-0 flex-1">
          <CommentComposer
            initialBody={comment.body}
            submitLabel="Save"
            placeholder="Edit comment…"
            onCancel={onCancelEdit}
            onSubmit={async (body) => {
              await onEdit(body);
              onCancelEdit();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <AuthorAvatar author={comment.author} source={comment.source} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="type-ui text-foreground">{comment.author}</span>
          {comment.source === "github" && (
            <IconBrandGithub
              className="size-3.5 text-muted-foreground"
              aria-label="GitHub"
            />
          )}
          <span className="type-meta text-muted-foreground tabular-nums">
            {timeAgo(comment.createdAt)}
          </span>
        </div>
        <div className="markdown mt-1 min-w-0 type-body">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
          >
            {comment.body}
          </Markdown>
        </div>
      </div>
    </div>
  );
}

/**
 * A quiet thread action (Add reply… / Resolve). Muted until hovered — the
 * accent is already spent on the gutter's add-comment button and the line
 * selection that got you here, and repeating it on every row of a thread would
 * leave nothing louder for the action that actually starts a review.
 */
function ThreadAction({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-sm type-body text-muted-foreground outline-offset-2 outline-ring transition-colors hover:text-foreground focus-visible:outline-2"
    >
      {icon}
      {children}
    </button>
  );
}

/**
 * A stack of comments anchored to one line, rendered as a single rounded card.
 * The opening comment sits flush; later comments are nested as replies. The
 * footer offers "Add reply…" (GitHub threads) and "Resolve" (removes the local
 * comments — deletion is how a local thread is resolved).
 */
export function CommentThread({
  comments,
  onDelete,
  onEdit,
  onReply,
}: {
  comments: ReadonlyArray<ReviewComment>;
  onDelete: (c: ReviewComment) => Promise<void>;
  onEdit?: (c: ReviewComment, body: string) => Promise<void>;
  onReply?: (c: ReviewComment, body: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const lastGithub = [...comments].reverse().find((c) => c.source === "github");
  const localComments = comments.filter((c) => c.source === "local");
  const editableComment =
    onEdit === undefined
      ? undefined
      : (localComments.find((c) => c.id === editingId) ?? localComments[0]);
  const canEdit = editableComment !== undefined && onEdit !== undefined;
  const canReply = onReply !== undefined && lastGithub !== undefined;
  const canResolve = localComments.length > 0;
  const showActions =
    !replying && editingId === null && (canEdit || canReply || canResolve);

  const resolve = async () => {
    if (resolving) return;
    setResolving(true);
    try {
      await Promise.all(localComments.map((c) => onDelete(c)));
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className={COMMENT_CARD}>
      <div className="flex flex-col gap-4">
        {comments.map((comment, i) => (
          <div key={comment.id} className={i === 0 ? undefined : REPLY_INDENT}>
            <CommentCard
              comment={comment}
              editing={editingId === comment.id}
              onCancelEdit={() => setEditingId(null)}
              onEdit={
                onEdit === undefined
                  ? undefined
                  : (body) => onEdit(comment, body)
              }
            />
          </div>
        ))}
      </div>

      <div className={`mt-3 ${REPLY_INDENT}`}>
        {replying && onReply !== undefined && lastGithub !== undefined ? (
          <CommentComposer
            submitLabel="Reply"
            placeholder="Reply…"
            onCancel={() => setReplying(false)}
            onSubmit={async (body) => {
              await onReply(lastGithub, body);
              setReplying(false);
            }}
          />
        ) : (
          showActions && (
            <div className="flex items-center gap-4">
              {canEdit && editableComment !== undefined && (
                <ThreadAction onClick={() => setEditingId(editableComment.id)}>
                  Edit
                </ThreadAction>
              )}
              {canReply && (
                <ThreadAction
                  onClick={() => setReplying(true)}
                  icon={<IconCornerDownRight className="size-4" />}
                >
                  Add reply…
                </ThreadAction>
              )}
              {canResolve && (
                <ThreadAction onClick={() => void resolve()}>
                  {resolving ? "Resolving…" : "Resolve"}
                </ThreadAction>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

/** A standalone draft composer, card-styled to match `CommentThread`. */
export function DraftCard({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void;
  onSubmit: (body: string) => Promise<void>;
}) {
  return (
    <div className={COMMENT_CARD}>
      <CommentComposer onCancel={onCancel} onSubmit={onSubmit} />
    </div>
  );
}
