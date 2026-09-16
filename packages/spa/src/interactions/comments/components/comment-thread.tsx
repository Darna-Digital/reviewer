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
import {
  IconBrandGithub,
  IconCornerDownRight,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { MARKDOWN_TABLE_COMPONENTS } from "@/components/ui/markdown-table";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useListEditing } from "@/hooks/use-list-editing";
import { AuthorAvatar } from "@/interactions/comments/components/author-avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { isOptimisticId } from "@/interactions/comments/functions/optimistic-comments.functions";
import type { ReviewComment } from "@reviewer/core/comments";

/**
 * Where a draft (or new) comment is anchored. Declared with the rest of the
 * feature's types and re-exported here, which is where the views reach for it —
 * it used to be declared in both places, and the two were free to drift.
 */
export type { DraftLocation } from "@/interactions/comments/interfaces/comments.interfaces";

/**
 * Indent used to nest replies — and to line the action row up with what a
 * comment says. Matches the avatar (`size-7`) plus the `gap-3` beside it, so
 * "Edit" starts under the author's name rather than a few pixels shy of it.
 */
const REPLY_INDENT = "ml-10";

/**
 * The card a thread and a draft both sit in. Capped at 400px rather than
 * stretched to the pane: a comment anchored to one line reads as a note pinned
 * beside that line, and a card that runs the width of the diff stops looking
 * pinned to anything. It also keeps the prose to a measure you can actually
 * scan — the same cap opencode puts on its line comments.
 *
 * `comment-card` is the hook `styles.css` hangs the caret and selection colours
 * on: the file view slots this card inside the editor's `contenteditable`,
 * which blanks both for the code it is drawing itself.
 */
const COMMENT_CARD =
  "comment-card group/thread my-2 mr-3 ml-12 w-full max-w-100 min-w-0 overflow-hidden rounded-md bg-surface-2 p-2.5 font-sans text-card-foreground shadow-raised";

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
  // A comment is written in the same hand as a prompt to an agent — a list of
  // the things that should change — so it keeps a list going the same way.
  const editList = useListEditing({
    textareaRef: ref,
    text: body,
    setText: setBody,
  });

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
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
            return;
          }
          if (e.key === "Escape") {
            onCancel();
            return;
          }
          editList(e);
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

/**
 * Take a single comment off the review. Offered per comment rather than on the
 * thread's action row, which acts on the thread as a whole: a thread is several
 * comments stacked together, and "delete" there would not say whose. Kept quiet
 * until the comment is under the cursor — a destructive control on every card,
 * always lit, is louder than every comment it sits on.
 */
function DeleteCommentButton({ onDelete }: { onDelete: () => Promise<void> }) {
  const [deleting, setDeleting] = useState(false);

  return (
    <button
      type="button"
      aria-label="Delete comment"
      disabled={deleting}
      onClick={() => {
        setDeleting(true);
        void onDelete().finally(() => setDeleting(false));
      }}
      className="ml-auto rounded-sm p-0.5 text-muted-foreground opacity-0 outline-offset-2 outline-ring transition group-hover/comment:opacity-100 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-2 disabled:opacity-40"
    >
      <IconX className="size-3.5" />
    </button>
  );
}

function CommentCard({
  comment,
  editing,
  onEdit,
  onCancelEdit,
  onDelete,
}: {
  comment: ReviewComment;
  editing: boolean;
  onEdit?: (body: string) => Promise<void>;
  onCancelEdit?: () => void;
  onDelete?: () => Promise<void>;
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

  // Written, shown, and not yet acknowledged by whoever stores it. A local
  // comment passes through this state too fast to see; a GitHub one is a round
  // trip to their servers, so the card says so rather than showing a comment
  // that looks filed when it is still in flight — and rather than inventing the
  // author, which only GitHub can name. See `optimistic-comments.functions`.
  const pending = isOptimisticId(comment.id);

  return (
    <div className={cn("group/comment flex gap-3", pending && "opacity-60")}>
      <AuthorAvatar author={comment.author} source={comment.source} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="type-ui text-foreground">{comment.author}</span>
          {comment.source === "github" && (
            <IconBrandGithub
              className="size-3.5 text-muted-foreground"
              aria-label="GitHub"
            />
          )}
          <span className="type-meta text-muted-foreground/70 tabular-nums">
            {pending ? "Sending…" : timeAgo(comment.createdAt)}
          </span>
          {onDelete !== undefined && (
            <DeleteCommentButton onDelete={onDelete} />
          )}
        </div>
        <div className="markdown mt-0.5 min-w-0 type-body">
          <Markdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight]}
            components={MARKDOWN_TABLE_COMPONENTS}
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
 * comments — deletion is how a local thread is resolved). Each comment also
 * carries its own delete on its card, for taking one note off on its own.
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

  // Actions target a comment by id, and a comment still in flight does not have
  // its real one yet — replying to a pending GitHub comment would address a
  // parent GitHub has never heard of, and editing or resolving a pending local
  // one would name a row the server has not written. So the actions look past
  // anything unacknowledged; they come back as soon as it is confirmed, which
  // for a local comment is too fast to notice.
  const settled = comments.filter((c) => !isOptimisticId(c.id));
  const lastGithub = [...settled].reverse().find((c) => c.source === "github");
  const localComments = settled.filter((c) => c.source === "local");
  const editableComment =
    onEdit === undefined
      ? undefined
      : (localComments.find((c) => c.id === editingId) ?? localComments[0]);
  const canEdit = editableComment !== undefined && onEdit !== undefined;
  const canReply = onReply !== undefined && lastGithub !== undefined;
  const canResolve = localComments.length > 0;
  // Every comment the store has acknowledged carries its own delete. "Resolve"
  // in the footer still clears the local ones in one go; this is how a single
  // note goes without taking the rest of the thread with it.
  const deletable = (c: ReviewComment) => settled.includes(c);
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
      <div className="flex flex-col gap-3">
        {comments.map((comment, i) => (
          <div key={comment.id} className={cn(i > 0 && REPLY_INDENT)}>
            <CommentCard
              comment={comment}
              editing={editingId === comment.id}
              onCancelEdit={() => setEditingId(null)}
              onEdit={
                onEdit === undefined
                  ? undefined
                  : (body) => onEdit(comment, body)
              }
              onDelete={
                deletable(comment) ? () => onDelete(comment) : undefined
              }
            />
          </div>
        ))}
      </div>

      <div className={cn("mt-2", REPLY_INDENT)}>
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
            // Faint until you reach for the thread. What a note says is what
            // you came to read; what can be done about it is the second
            // question, and a row of full-strength verbs under every comment
            // answers it before it is asked. Focus reveals them too, so they
            // stay reachable from the keyboard.
            <div className="flex items-center gap-4 opacity-0 transition-opacity group-focus-within/thread:opacity-100 group-hover/thread:opacity-100">
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
  initialBody,
}: {
  onCancel: () => void;
  onSubmit: (body: string) => Promise<void>;
  /** Text to reopen with — a refused write handing the words back. */
  initialBody?: string;
}) {
  return (
    <div className={COMMENT_CARD}>
      <CommentComposer
        onCancel={onCancel}
        onSubmit={onSubmit}
        {...(initialBody === undefined ? {} : { initialBody })}
      />
    </div>
  );
}
