/**
 * A threaded discussion on an issue or a doc. Replies indent once and no
 * further — deeper nesting reads as a maze in a pane this narrow, so a reply to
 * a reply sits alongside its sibling and is understood from who it answers.
 */
import { IconCornerDownRight, IconDots } from "@tabler/icons-react"
import { useState } from "react"
import { initialsOf } from "@byconvo/core/identity"
import type {
  CommentNode,
  WorkspaceComment,
} from "@byconvo/core/workspace-comments"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea"
import { timeAgo } from "@/lib/relative-time"
import { cn } from "@/lib/utils"

interface CommentThreadProps {
  tree: ReadonlyArray<CommentNode>
  isLoading: boolean
  onPost: (body: string, parentId: string | null) => Promise<boolean>
  onEdit: (id: string, body: string) => void
  onRemove: (id: string) => void
  canEdit: (comment: WorkspaceComment) => boolean
  canDelete: (comment: WorkspaceComment) => boolean
}

function Avatar({ name, image }: { name: string; image: string | null }) {
  if (image !== null) {
    return (
      <img
        src={image}
        alt=""
        className="size-6 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-elevate-strong text-[10px] font-medium text-muted-foreground"
    >
      {initialsOf(name)}
    </span>
  )
}

function Composer({
  placeholder,
  autoFocus = false,
  onSubmit,
  onCancel,
  initialValue = "",
  submitLabel = "Comment",
}: {
  placeholder: string
  autoFocus?: boolean
  onSubmit: (body: string) => Promise<boolean> | void
  onCancel?: () => void
  initialValue?: string
  submitLabel?: string
}) {
  const [body, setBody] = useState(initialValue)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy || body.trim().length === 0) return
    setBusy(true)
    const result = await onSubmit(body)
    setBusy(false)
    if (result !== false) setBody("")
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        autoFocus={autoFocus}
        value={body}
        placeholder={placeholder}
        rows={3}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          // Enter alone breaks the line; the modifier sends, as every other
          // comment box in this app does.
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            void submit()
          }
          if (event.key === "Escape" && onCancel) onCancel()
        }}
        className="min-h-[72px] resize-y text-sm"
      />
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={body.trim().length === 0 || busy}
          onClick={() => void submit()}
        >
          {submitLabel}
        </Button>
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          ⌘↵ to send
        </span>
      </div>
    </div>
  )
}

function Comment({
  node,
  depth,
  onPost,
  onEdit,
  onRemove,
  canEdit,
  canDelete,
}: {
  node: CommentNode
  depth: number
  onPost: CommentThreadProps["onPost"]
  onEdit: CommentThreadProps["onEdit"]
  onRemove: CommentThreadProps["onRemove"]
  canEdit: CommentThreadProps["canEdit"]
  canDelete: CommentThreadProps["canDelete"]
}) {
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const { comment } = node
  const editable = canEdit(comment)
  const deletable = canDelete(comment)

  return (
    <div className={cn(depth > 0 && "border-l border-border/60 pl-4")}>
      <div className="group flex gap-2.5 py-2">
        <Avatar name={comment.author.name} image={comment.author.image} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-medium">
              {comment.author.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {timeAgo(comment.createdAt)}
            </span>
            {comment.edited && (
              <span className="text-xs text-muted-foreground">edited</span>
            )}
            {(editable || deletable) && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Comment actions"
                  className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-elevate hover:text-foreground focus-visible:opacity-100"
                >
                  <IconDots className="size-3.5" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {editable && (
                    <DropdownMenuItem onClick={() => setEditing(true)}>
                      Edit
                    </DropdownMenuItem>
                  )}
                  {deletable && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => onRemove(comment.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {editing ? (
            <div className="mt-1.5">
              <Composer
                autoFocus
                placeholder="Edit your comment…"
                initialValue={comment.body}
                submitLabel="Save"
                onCancel={() => setEditing(false)}
                onSubmit={(body) => {
                  onEdit(comment.id, body)
                  setEditing(false)
                }}
              />
            </div>
          ) : (
            <p className="mt-0.5 text-sm whitespace-pre-wrap text-foreground/90">
              {comment.body}
            </p>
          )}

          {!editing && (
            <button
              type="button"
              onClick={() => setReplying((open) => !open)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <IconCornerDownRight className="size-3" />
              Reply
            </button>
          )}

          {replying && (
            <div className="mt-2">
              <Composer
                autoFocus
                placeholder="Write a reply…"
                submitLabel="Reply"
                onCancel={() => setReplying(false)}
                onSubmit={async (body) => {
                  const posted = await onPost(body, comment.id)
                  if (posted) setReplying(false)
                  return posted
                }}
              />
            </div>
          )}
        </div>
      </div>

      {node.replies.length > 0 && (
        <div className="ml-8">
          {node.replies.map((reply) => (
            <Comment
              key={reply.comment.id}
              node={reply}
              // One indent, then flat: see the note at the top of the file.
              depth={Math.min(depth + 1, 1)}
              onPost={onPost}
              onEdit={onEdit}
              onRemove={onRemove}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CommentThread({
  tree,
  isLoading,
  onPost,
  onEdit,
  onRemove,
  canEdit,
  canDelete,
}: CommentThreadProps) {
  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        <div className="h-12 animate-pulse rounded-md bg-elevate" />
      ) : (
        tree.map((node) => (
          <Comment
            key={node.comment.id}
            node={node}
            depth={0}
            onPost={onPost}
            onEdit={onEdit}
            onRemove={onRemove}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        ))
      )}
      <Composer
        placeholder="Leave a comment…"
        onSubmit={(body) => onPost(body, null)}
      />
    </div>
  )
}
