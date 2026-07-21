/**
 * The conversation: user prompts as right-aligned bubbles, assistant replies
 * as left-aligned markdown, with each turn's work log (tool calls, thinking)
 * rendered as small collapsed rows above the reply — t3code's timeline shape.
 * Auto-follows the stream unless the reader has scrolled up.
 */
import {
  IconAlertCircle,
  IconBrain,
  IconChevronDown,
  IconChevronUp,
  IconPlayerStopFilled,
  IconTool,
} from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"
import type { Chat, ChatActivity, ChatMessage } from "@byconvo/core"
import { cn } from "@/lib/utils"
import { AttachmentGrid, AttachmentPreview } from "./image-attachments"
import { ChatMarkdown } from "./chat-markdown"
import { Message, MessageBubble } from "./message"

function ActivityRow({ activity }: { activity: ChatActivity }) {
  const Icon =
    activity.tone === "error"
      ? IconAlertCircle
      : activity.kind === "thinking"
        ? IconBrain
        : IconTool
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 py-0.5 text-xs",
        activity.tone === "error" ? "text-destructive" : "text-muted-foreground"
      )}
      title={activity.detail ?? undefined}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="truncate">{activity.summary}</span>
    </div>
  )
}

/** How many leading steps a long work log shows before collapsing. */
const COLLAPSED_STEPS = 4

/**
 * A turn's work log (tool calls + thinking). Long logs collapse to the first
 * few steps — the bottom edge fades out to hint at more — with a toggle below,
 * so a research-heavy turn doesn't push the actual reply off-screen.
 */
function WorkLog({ activities }: { activities: ChatActivity[] }) {
  const [expanded, setExpanded] = useState(false)
  const collapsible = activities.length > COLLAPSED_STEPS + 1
  const collapsed = collapsible && !expanded
  const visible = collapsed ? activities.slice(0, COLLAPSED_STEPS) : activities
  return (
    <div className="mb-1.5 border-l pl-3">
      <div
        className={cn(
          collapsed &&
            "[mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        )}
      >
        {visible.map((a) => (
          <ActivityRow key={a.id} activity={a} />
        ))}
      </div>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded ? (
            <>
              <IconChevronUp className="size-3.5" />
              Show less
            </>
          ) : (
            <>
              <IconChevronDown className="size-3.5" />
              Show {activities.length - COLLAPSED_STEPS} more steps
            </>
          )}
        </button>
      )}
    </div>
  )
}

function WorkingDots() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="Working">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </span>
  )
}

/**
 * A failed turn's error. The lead paragraph (up to the first blank line) shows
 * inline; any remaining detail — long remediation like the logged-out hint —
 * collapses behind a native "Details" disclosure so the chip stays compact.
 */
function TurnError({ message }: { message: string }) {
  const [summary, ...rest] = message.split(/\n\n+/)
  const details = rest.join("\n\n").trim()
  return (
    <div className="flex max-w-3xl items-start gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
      <IconAlertCircle className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <span className="break-words whitespace-pre-wrap">{summary}</span>
        {details.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer opacity-80 select-none hover:opacity-100">
              Details
            </summary>
            <span className="mt-1 block break-words whitespace-pre-wrap opacity-90">
              {details}
            </span>
          </details>
        )}
      </div>
    </div>
  )
}

export function MessagesTimeline({ chat }: { chat: Chat }) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pinnedToBottom = useRef(true)
  const lastUserMessageId = useRef<string | null>(null)

  // Track whether the reader is at the bottom; only then auto-follow.
  const onScroll = () => {
    const el = scrollRef.current
    if (el === null) return
    pinnedToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  useEffect(() => {
    const el = scrollRef.current
    if (el === null) return
    // When the reader sends a new message, always jump to the bottom so they
    // can see their own question — even if they'd scrolled up beforehand.
    let latestUserMessageId: string | null = null
    for (const m of chat.messages) {
      if (m.role === "user") latestUserMessageId = m.id
    }
    const sentNewMessage =
      latestUserMessageId !== null &&
      latestUserMessageId !== lastUserMessageId.current
    if (latestUserMessageId !== null) {
      lastUserMessageId.current = latestUserMessageId
    }
    if (sentNewMessage) pinnedToBottom.current = true
    if (pinnedToBottom.current) el.scrollTop = el.scrollHeight
  }, [chat])

  const activitiesByTurn = new Map<string, ChatActivity[]>()
  for (const activity of chat.activities) {
    const group = activitiesByTurn.get(activity.turnId) ?? []
    group.push(activity)
    activitiesByTurn.set(activity.turnId, group)
  }

  const running = chat.latestTurn?.state === "running"
  const turnError =
    chat.latestTurn !== null && chat.latestTurn.state === "error"
      ? chat.latestTurn.errorMessage
      : null

  const renderMessage = (message: ChatMessage) => {
    if (message.role === "user") {
      const attachments = message.attachments ?? []
      return (
        <Message key={message.id} align="end">
          <div className="flex max-w-[80%] flex-col items-end gap-2">
            {attachments.length > 0 && (
              <AttachmentGrid className="justify-end">
                {attachments.map((attachment, i) => (
                  <AttachmentPreview
                    key={`${attachment.name}-${i}`}
                    attachment={attachment}
                  />
                ))}
              </AttachmentGrid>
            )}
            {message.text.length > 0 && (
              <MessageBubble>{message.text}</MessageBubble>
            )}
          </div>
        </Message>
      )
    }
    const work = activitiesByTurn.get(message.turnId) ?? []
    const streaming = message.streaming && running
    return (
      <Message key={message.id} align="start">
        <div className="flex w-full min-w-0 flex-col">
          {work.length > 0 && <WorkLog activities={work} />}
          {message.text.length > 0 ? (
            <ChatMarkdown text={message.text} />
          ) : streaming ? null : message.streaming ? (
            // A streaming message whose turn is gone (interrupted/server died).
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconPlayerStopFilled className="size-3.5" /> Stopped before
              replying.
            </div>
          ) : null}
          {streaming && <WorkingDots />}
        </div>
      </Message>
    )
  }

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
        {chat.messages.map(renderMessage)}
        {turnError !== null && <TurnError message={turnError} />}
      </div>
    </div>
  )
}
