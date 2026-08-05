/**
 * The conversation: user prompts as right-aligned bubbles, assistant replies
 * as left-aligned markdown, with each turn's work log (tool calls, thinking)
 * rendered as small collapsed rows above the reply — t3code's timeline shape.
 * Auto-follows the stream unless the reader has scrolled up.
 */
import { IconAlertCircle, IconPlayerStopFilled } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Chat, ChatActivity, ChatMessage } from "@byconvo/core/chats";
import { ThinkingIndicator } from "@/components/ui/thinking-indicator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toConversationSections } from "../functions/conversation-sections.functions";
import { activeWorkStep, toWorkSteps } from "../functions/work-log.functions";
import { AttachmentGrid, AttachmentPreview } from "./image-attachments";
import { ChatMarkdown } from "./chat-markdown";
import { ConversationSections } from "./conversation-sections";
import { Message, MessageBubble } from "./message";
import { WorkLog } from "./work-log";

/**
 * A failed turn's error. The lead paragraph (up to the first blank line) shows
 * inline; any remaining detail — long remediation like the logged-out hint —
 * collapses behind a native "Details" disclosure so the chip stays compact.
 */
function TurnError({ message }: { message: string }) {
  const [summary, ...rest] = message.split(/\n\n+/);
  const details = rest.join("\n\n").trim();
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
  );
}

/** How far below the viewport's top edge a question has to sit before the rail
 * counts it as the one being read. */
const SECTION_ACTIVE_LINE = 140;
const SECTION_SCROLL_MARGIN = 24;
const SCROLL_INTERRUPTS = ["wheel", "touchstart", "pointerdown", "keydown"];

/**
 * `scroll-behavior: smooth` and `scrollTo({behavior})` are silently ignored
 * inside the ScrollArea's overflow-hidden root on Chromium, so ease the jump
 * ourselves — 20% of the remaining distance per frame, abandoned the moment the
 * reader takes the scroll back.
 */
function easeScrollTo(viewport: HTMLElement, top: number) {
  const target = Math.max(
    0,
    Math.min(top, viewport.scrollHeight - viewport.clientHeight)
  );
  let running = true;
  const stop = () => {
    running = false;
    for (const type of SCROLL_INTERRUPTS) {
      viewport.removeEventListener(type, stop);
    }
  };
  for (const type of SCROLL_INTERRUPTS) {
    viewport.addEventListener(type, stop, { passive: true });
  }
  const frame = () => {
    if (!running) return;
    const delta = target - viewport.scrollTop;
    if (Math.abs(delta) <= 1) {
      viewport.scrollTop = target;
      stop();
      return;
    }
    viewport.scrollTop += delta * 0.2;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

export function MessagesTimeline({ chat }: { chat: Chat }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedToBottom = useRef(true);
  const lastUserMessageId = useRef<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const sections = toConversationSections(chat.messages);
  const sectionIds = new Set(sections.map((section) => section.id));
  const firstSectionId = sections[0]?.id ?? null;

  const syncFrame = useRef(0);
  const queueSectionSync = useCallback(() => {
    if (syncFrame.current !== 0) return;
    syncFrame.current = requestAnimationFrame(() => {
      syncFrame.current = 0;
      const el = scrollRef.current;
      if (el === null) return;
      const viewportTop = el.getBoundingClientRect().top;
      let current: string | null = null;
      for (const anchor of el.querySelectorAll<HTMLElement>(
        "[data-section-id]"
      )) {
        if (
          anchor.getBoundingClientRect().top - viewportTop >
          SECTION_ACTIVE_LINE
        ) {
          break;
        }
        current = anchor.dataset.sectionId ?? null;
      }
      setActiveSectionId(current ?? firstSectionId);
    });
  }, [firstSectionId]);
  useEffect(() => () => cancelAnimationFrame(syncFrame.current), []);

  const scrollToSection = (id: string) => {
    const el = scrollRef.current;
    if (el === null) return;
    const anchor = el.querySelector<HTMLElement>(
      `[data-section-id="${CSS.escape(id)}"]`
    );
    if (anchor === null) return;
    pinnedToBottom.current = false;
    setActiveSectionId(id);
    easeScrollTo(
      el,
      anchor.getBoundingClientRect().top -
        el.getBoundingClientRect().top +
        el.scrollTop -
        SECTION_SCROLL_MARGIN
    );
  };

  // Track whether the reader is at the bottom; only then auto-follow.
  const onScroll = () => {
    const el = scrollRef.current;
    if (el === null) return;
    pinnedToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    queueSectionSync();
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (el === null) return;
    // When the reader sends a new message, always jump to the bottom so they
    // can see their own question — even if they'd scrolled up beforehand.
    let latestUserMessageId: string | null = null;
    for (const m of chat.messages) {
      if (m.role === "user") latestUserMessageId = m.id;
    }
    const sentNewMessage =
      latestUserMessageId !== null &&
      latestUserMessageId !== lastUserMessageId.current;
    if (latestUserMessageId !== null) {
      lastUserMessageId.current = latestUserMessageId;
    }
    if (sentNewMessage) pinnedToBottom.current = true;
    if (pinnedToBottom.current) el.scrollTop = el.scrollHeight;
    queueSectionSync();
  }, [chat, queueSectionSync]);

  const activitiesByTurn = new Map<string, ChatActivity[]>();
  for (const activity of chat.activities) {
    const group = activitiesByTurn.get(activity.turnId) ?? [];
    group.push(activity);
    activitiesByTurn.set(activity.turnId, group);
  }

  const running = chat.latestTurn?.state === "running";
  const turnError =
    chat.latestTurn !== null && chat.latestTurn.state === "error"
      ? chat.latestTurn.errorMessage
      : null;

  const renderMessage = (message: ChatMessage) => {
    if (message.role === "user") {
      const attachments = message.attachments ?? [];
      return (
        <Message key={message.id} align="end">
          <div
            data-section-id={
              sectionIds.has(message.id) ? message.id : undefined
            }
            className="flex max-w-[80%] flex-col items-end gap-2"
          >
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
      );
    }
    const streaming = message.streaming && running;
    const steps = toWorkSteps(
      activitiesByTurn.get(message.turnId) ?? [],
      streaming
    );
    // While a tool runs, name it; while the model is generating text, there is
    // genuinely nothing to name, so the indicator cycles instead of inventing.
    const active = streaming ? activeWorkStep(steps) : undefined;
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
    );
  };

  return (
    <div className="@container relative flex min-h-0 flex-1 flex-col">
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
      <ConversationSections
        sections={sections}
        activeId={activeSectionId}
        onSelect={scrollToSection}
      />
    </div>
  );
}
