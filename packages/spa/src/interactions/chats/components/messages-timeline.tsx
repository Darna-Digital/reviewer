/**
 * The conversation: user prompts as right-aligned bubbles, assistant replies
 * as left-aligned markdown, with each turn's work log (tool calls, thinking)
 * rendered as small collapsed rows above the reply — t3code's timeline shape.
 * Auto-follows the stream unless the reader has scrolled up.
 */
import { IconAlertCircle, IconPlayerStopFilled } from "@tabler/icons-react"
import { useEffect, useRef } from "react"
import type { Chat, ChatActivity, ChatMessage } from "@byconvo/core/chats"
import { ThinkingIndicator } from "@/components/ui/thinking-indicator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { activeWorkStep, toWorkSteps } from "../functions/work-log.functions"
import { AttachmentGrid, AttachmentPreview } from "./image-attachments"
import { ChatMarkdown } from "./chat-markdown"
import { Message, MessageBubble } from "./message"
import { WorkLog } from "./work-log"

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
    const streaming = message.streaming && running
    const steps = toWorkSteps(
      activitiesByTurn.get(message.turnId) ?? [],
      streaming
    )
    // While a tool runs, name it; while the model is generating text, there is
    // genuinely nothing to name, so the indicator cycles instead of inventing.
    const active = streaming ? activeWorkStep(steps) : undefined
    return (
      <Message key={message.id} align="start">
        <div className="flex w-full min-w-0 flex-col">
          {steps.length > 0 && <WorkLog steps={steps} running={streaming} />}
          {message.text.length > 0 ? (
            <ChatMarkdown text={message.text} />
          ) : streaming ? null : message.streaming ? (
            // A streaming message whose turn is gone (interrupted/server died).
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <IconPlayerStopFilled className="size-3.5" /> Stopped before
              replying.
            </div>
          ) : null}
          {streaming && (
            <ThinkingIndicator
              className="py-1"
              {...(active !== undefined ? { label: active.summary } : {})}
            />
          )}
        </div>
      </Message>
    )
  }

  return (
    <ScrollArea
      viewportRef={scrollRef}
      onViewportScroll={onScroll}
      className="min-h-0 flex-1"
      viewportClassName="scroll-fade overscroll-contain"
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
        {chat.messages.map(renderMessage)}
        {turnError !== null && <TurnError message={turnError} />}
      </div>
    </ScrollArea>
  )
}
