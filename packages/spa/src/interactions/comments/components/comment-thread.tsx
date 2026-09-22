/**
 * Shared review-comment UI — the composer, a single comment card, and the
 * thread container that stacks them. Used by both the diff surface (`DiffPane`)
 * and the single-file browse surface (`CodeView`) so inline comments look and
 * behave identically wherever they appear.
 *
 * Visually modelled on the Pierre / diffs.com comment threads: a soft rounded
 * card, round author avatars, name + relative timestamp, replies nested under
 * the opening comment, and a muted "Add reply… / Resolve" action row. The
 * composer is a Messages-style pill — the writer's monogram, the field, and a
 * circled send arrow — built on the theme tokens so it adapts to light & dark.
 */
import {
  IconArrowUp,
  IconBrandGithub,
  IconCornerDownRight,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import { MARKDOWN_TABLE_COMPONENTS } from "@/components/ui/markdown-table";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useListEditing } from "@/hooks/use-list-editing";
import { useCommentAuthor } from "@/interactions/comments/adapters/comment-author.hook.adapter";
import { AuthorAvatar } from "@/interactions/comments/components/author-avatar";
import { Button } from "@/components/ui/button";
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
 * The card a thread sits in. Capped at 400px rather than stretched to the
 * pane: a comment anchored to one line reads as a note pinned beside that
 * line, and a card that runs the width of the diff stops looking pinned to
 * anything. It also keeps the prose to a measure you can actually scan — the
 * same cap opencode puts on its line comments.
 *
 * `comment-card` is the hook `styles.css` hangs the caret and selection colours
 * on: the file view slots this card inside the editor's `contenteditable`,
 * which blanks both for the code it is drawing itself.
 *
 * The card is inset from the code on every side — the same gap left and right,
 * and the vertical one above and below — so the note reads as a thing laid over
 * the file rather than a block welded to the code column. An annotation begins
 * at that column, so the indent is the card's own margin.
 */
const COMMENT_CARD =
  "comment-card group/thread my-2 mx-3 w-full max-w-100 min-w-0 overflow-hidden rounded-2xl bg-surface-2 p-3 font-sans text-card-foreground shadow-raised";

/**
 * The composer's pill. The radius is half the height of a one-line composer —
 * monogram, field and send button are all 28px inside 8px of padding — so a
 * fresh draft is a capsule, and one that has grown a few lines keeps the same
 * soft corners rather than turning into a stadium. On those lines the monogram
 * stays with the first, where a comment's avatar sits, and the send button
 * with the last, where the draft ends — the way Messages lays its field out.
 */
const COMPOSER_PILL =
  "comment-composer flex min-w-0 items-end gap-2.5 rounded-[22px] p-2 pl-2.5 font-sans";

/**
 * A draft's own pill and a pill nested in a thread have different backdrops:
 * the draft *is* the card, so it takes the card's material; a reply or an edit
 * sits inside that material already, and is drawn a step lighter with a
 * hairline so it still reads as a field.
 */
const COMPOSER_STANDALONE = cn(
  COMPOSER_PILL,
  "comment-card mx-3 my-2 w-full max-w-100 bg-surface-2 text-card-foreground shadow-raised"
);
const COMPOSER_NESTED = cn(COMPOSER_PILL, "bg-background ring-1 ring-border");

export function CommentComposer({
  onCancel,
  onSubmit,
  autoFocus = true,
  placeholder = "Leave a comment…",
  initialBody = "",
  author,
  className = COMPOSER_NESTED,
}: {
  onCancel: () => void;
  onSubmit: (body: string) => Promise<void>;
  autoFocus?: boolean;
  placeholder?: string;
  initialBody?: string;
  /** Whose monogram the pill wears; the repo's git identity when omitted. */
  author?: string;
  className?: string;
}) {
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const self = useCommentAuthor();
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

  const canSubmit = body.trim().length > 0 && !busy;

  const submit = async () => {
    if (!canSubmit) return;
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
    <div
      className={className}
      // A pill with nothing in it goes away when the focus leaves it — there
      // is no Cancel to reach for, and nothing typed to lose. One with words
      // in it stays, and is dismissed with Escape.
      onBlur={(e) => {
        const leaving = !e.currentTarget.contains(e.relatedTarget);
        if (leaving && body.trim().length === 0 && !busy) onCancel();
      }}
    >
      <AuthorAvatar
        author={author ?? self}
        source="local"
        className="self-start"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <textarea
          ref={ref}
          rows={1}
          value={body}
          placeholder={placeholder}
          className="field-sizing-content max-h-60 w-full resize-none bg-transparent py-1 type-body outline-none placeholder:text-muted-foreground placeholder:select-none"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // Enter files the comment, as it sends a prompt in the chat beside
            // it; ⇧Enter opens a line, and inside a list carries the list on.
            if (e.key === "Enter" && !e.shiftKey) {
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
        {error !== null && (
          <p className="truncate pb-1 type-meta text-destructive">{error}</p>
        )}
      </div>
      <Button
        size="icon"
        className="size-7 shrink-0 rounded-full"
        aria-label="Post comment"
        disabled={!canSubmit}
        onClick={() => void submit()}
      >
        <IconArrowUp className="size-4" />
      </Button>
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
      <CommentComposer
        author={comment.author}
        initialBody={comment.body}
        placeholder="Edit comment…"
        onCancel={onCancelEdit}
        onSubmit={async (body) => {
          await onEdit(body);
          onCancelEdit();
        }}
      />
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
            />
          </div>
        ))}
      </div>

      <div className={cn("mt-2", REPLY_INDENT)}>
        {replying && onReply !== undefined && lastGithub !== undefined ? (
          <CommentComposer
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

/** A standalone draft composer — the pill on its own, in the card's material. */
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
    <CommentComposer
      className={COMPOSER_STANDALONE}
      onCancel={onCancel}
      onSubmit={onSubmit}
      {...(initialBody === undefined ? {} : { initialBody })}
    />
  );
}
