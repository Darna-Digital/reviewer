/**
 * A chat row in the /chats sidebar. Hovering opens a side preview card with the
 * untruncated title, the tail of the conversation and the session's metadata —
 * the same elevated panel language as the review bar's session previews, rather
 * than a tiny tooltip bubble.
 *
 * The conversation tail is fetched only once a card opens, so scrolling past a
 * hundred rows costs nothing.
 */
import { IconGitBranch, IconMessage, IconX } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { useRef, useState } from "react"
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card"
import { agentIcon } from "@/interactions/threads/components/agent-icons"
import { agentLabel } from "@/interactions/threads/interfaces/agents"
import type { ChatMessage, ChatSummary } from "@byconvo/core/chats"
import { useChatPreview } from "@/lib/queries"
import { timeAgo } from "@/lib/relative-time"
import { cn } from "@/lib/utils"

const HOVER_DELAY_MS = 400
const HOVER_CLOSE_DELAY_MS = 100
const PREVIEW_TURNS = 3

function TurnStateDot({ state }: { state: ChatSummary["turnState"] }) {
  if (state === null || state === "completed") return null
  return (
    <span
      className={cn(
        "size-1.5 shrink-0 rounded-full",
        state === "running" && "animate-pulse bg-brand-500",
        state === "error" && "bg-destructive",
        state === "interrupted" && "bg-brand-500"
      )}
      aria-label={`turn ${state}`}
    />
  )
}

function ConversationTail({
  messages,
  assistantLabel,
}: {
  messages: ReadonlyArray<ChatMessage>
  assistantLabel: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {messages.map((m) => (
        <div key={m.id} className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            {m.role === "user" ? "You" : assistantLabel}
          </span>
          <p className="line-clamp-2 text-xs leading-relaxed break-words">
            {m.text}
          </p>
        </div>
      ))}
    </div>
  )
}

export function ChatRow({
  chat,
  active,
  onDelete,
}: {
  chat: ChatSummary
  active: boolean
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  // Opening a thread shouldn't leave a preview of it hovering over the view —
  // a click closes the card and holds it shut until the pointer leaves.
  const clicked = useRef(false)
  const preview = useChatPreview(chat.id, open)
  const Icon = agentIcon(chat.provider)
  const assistantLabel = agentLabel(chat.provider)

  const tail = (preview.data?.messages ?? [])
    .filter((m) => m.text.trim().length > 0)
    .slice(-PREVIEW_TURNS)

  return (
    <PreviewCard
      open={open}
      onOpenChange={(next) => setOpen(next && !clicked.current)}
    >
      <PreviewCardTrigger
        delay={HOVER_DELAY_MS}
        closeDelay={HOVER_CLOSE_DELAY_MS}
        render={
          <Link
            to="/chats/$chatId"
            params={{ chatId: chat.id }}
            onPointerDown={() => {
              clicked.current = true
              setOpen(false)
            }}
            onPointerLeave={() => {
              clicked.current = false
            }}
            className={cn(
              "group/row mb-0.5 flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 text-left hover:bg-muted/60",
              active && "bg-muted"
            )}
          />
        }
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-1.5">
            <TurnStateDot state={chat.turnState} />
            <span className="min-w-0 flex-1 truncate text-sm">
              {chat.title}
            </span>
          </div>
          {chat.lastMessage !== null && chat.lastMessage.length > 0 && (
            <div className="truncate text-xs text-muted-foreground">
              {chat.lastMessage}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Delete thread"
          className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-destructive"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onDelete()
          }}
        >
          <IconX className="size-3.5" />
        </button>
      </PreviewCardTrigger>
      <PreviewCardContent side="right" align="start" className="w-80 gap-2 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 leading-snug font-medium">
            {chat.title}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo(chat.updatedAt)}
          </span>
        </div>
        {tail.length > 0 ? (
          <ConversationTail messages={tail} assistantLabel={assistantLabel} />
        ) : (
          chat.lastMessage !== null &&
          chat.lastMessage.length > 0 && (
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground break-words">
              {chat.lastMessage}
            </p>
          )
        )}
        <div className="flex flex-col gap-1 border-t pt-2 text-xs text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5">
            <IconGitBranch className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">{chat.branch}</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon className="size-3.5 shrink-0" />
            <span className="shrink-0">{assistantLabel}</span>
            {chat.model.length > 0 && (
              <span className="min-w-0 truncate opacity-70">{chat.model}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <IconMessage className="size-3.5 shrink-0" />
            <span className="tabular-nums">
              {chat.messageCount === 1
                ? "1 message"
                : `${chat.messageCount} messages`}
            </span>
          </div>
        </div>
      </PreviewCardContent>
    </PreviewCard>
  )
}
