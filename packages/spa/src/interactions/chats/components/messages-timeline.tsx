/**
 * The conversation: user prompts as right-aligned bubbles, assistant replies
 * as left-aligned markdown, with each turn's work log (tool calls, thinking)
 * rendered as small collapsed rows above the reply — t3code's timeline shape.
 * Auto-follows the stream unless the reader has scrolled up.
 */
import { IconAlertCircle, IconPlayerStopFilled } from "@tabler/icons-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Chat, ChatActivity, ChatMessage } from "@reviewer/core/chats";
import { ThinkingIndicator } from "@/components/ui/thinking-indicator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toConversationSections } from "../functions/conversation-sections.functions";
import {
  groupActivitiesByTurn,
  type ActivitiesByTurn,
} from "../functions/turn-activities.functions";
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

/**
 * Every row below is memoised, and that is the whole point of this file's
 * shape.
 *
 * A conversation is the one surface here that re-renders continuously: a
 * streamed reply lands a token at a time, and scrolling it moves the rail's
 * active section on every frame. Rendered plainly — `messages.map(...)` — each
 * of those updates re-rendered all N messages, which means re-parsing and
 * re-highlighting the markdown of the entire conversation. The cost scaled with
 * how much had been said rather than with what had changed, so the longer a
 * session ran the worse it got, in the exact place a session is read.
 *
 * The reducer already makes the fix available: appending a delta rebuilds the
 * message array but returns every untouched message by identity, so `memo` on
 * a row is an accurate test of "did this message move". A token now re-renders
 * one row, and a scroll re-renders none.
 */
const EMPTY_ACTIVITIES: ReadonlyArray<ChatActivity> = [];

const UserMessage = memo(function UserMessageRow({
  message,
  isSectionAnchor,
}: {
  message: ChatMessage;
  /** Whether the rail counts this prompt as opening a section. */
  isSectionAnchor: boolean;
}) {
  const attachments = message.attachments ?? [];
  return (
    <Message align="end">
      <div
        data-section-id={isSectionAnchor ? message.id : undefined}
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
});

const AssistantMessage = memo(function AssistantMessageRow({
  message,
  activities,
  streaming,
}: {
  message: ChatMessage;
  activities: ReadonlyArray<ChatActivity>;
  /**
   * Resolved by the caller rather than passed down as the chat's `running`
   * flag: a settled message is never streaming whatever the turn is doing, so
   * resolving it here would hand every row a prop that flips at the end of
   * every turn and re-render the whole conversation for it.
   */
  streaming: boolean;
}) {
  const steps = toWorkSteps(activities, streaming);
  // While a tool runs, name it; while the model is generating text, there is
  // genuinely nothing to name, so the indicator cycles instead of inventing.
  const active = streaming ? activeWorkStep(steps) : undefined;
  return (
    <Message align="start">
      <div className="flex w-full min-w-0 flex-col">
        {steps.length > 0 && <WorkLog steps={steps} />}
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
});

/**
 * How much of a conversation is built when it opens, and how much more each
 * time the reader climbs past the top of it.
 *
 * A session opens at the bottom, so everything above the last few turns is
 * off-screen — and building it anyway means parsing and highlighting the
 * markdown of the whole session before the first frame. That cost scales with
 * how long the session ran, which is why the ones worth coming back to were the
 * slowest to open. Counted from the start of the conversation rather than the
 * end, so a reply streaming in at the bottom never pushes an older message the
 * reader has already uncovered back out of the timeline.
 */
const OPENING_MESSAGES = 8;
const OLDER_MESSAGES_STEP = 16;
/** How near the top the reader gets before the next block is built. */
const BUILD_OLDER_WITHIN_PX = 600;

export function MessagesTimeline({ chat }: { chat: Chat }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const pinnedToBottom = useRef(true);
  const lastUserMessageId = useRef<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [unbuilt, setUnbuilt] = useState(() =>
    Math.max(0, chat.messages.length - OPENING_MESSAGES)
  );

  // Keyed on the message list, not on the chat: the rail is redrawn when what
  // was said changes, and not when the reader merely scrolls past it (which
  // sets `activeSectionId`, and so re-renders this component, several times a
  // second). Both walks read every message and run regexes over every reply.
  const sections = useMemo(
    () => toConversationSections(chat.messages),
    [chat.messages]
  );
  const sectionIds = useMemo(
    () => new Set(sections.map((section) => section.id)),
    [sections]
  );
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

  /**
   * Building the block above the one being read moves everything down by its
   * height, so the reader's place is held from the bottom of the timeline
   * instead of the top and restored once it is laid out — otherwise uncovering
   * older messages would throw the page they were reading off the screen.
   */
  const heldFromBottom = useRef<number | null>(null);
  const buildOlder = useCallback(
    (upTo: number) => {
      const next = Math.max(0, upTo);
      // Nothing to build is also nothing to hold a place through: an anchor set
      // here would be restored against whatever moved the timeline next.
      if (next >= unbuilt) return;
      const el = scrollRef.current;
      if (el !== null) heldFromBottom.current = el.scrollHeight - el.scrollTop;
      setUnbuilt(next);
    },
    [unbuilt]
  );

  const revealSection = (id: string) => {
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

  // The rail spans the whole conversation, so a tick can name a question that
  // is not built yet: build back as far as it and jump once it is there.
  const pendingSection = useRef<string | null>(null);
  const scrollToSection = (id: string) => {
    const index = chat.messages.findIndex((message) => message.id === id);
    if (index !== -1 && index < unbuilt) {
      pendingSection.current = id;
      buildOlder(index);
      return;
    }
    revealSection(id);
  };

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el === null) return;
    if (heldFromBottom.current !== null) {
      el.scrollTop = el.scrollHeight - heldFromBottom.current;
      heldFromBottom.current = null;
    }
    const jumpTo = pendingSection.current;
    if (jumpTo !== null) {
      pendingSection.current = null;
      revealSection(jumpTo);
      return;
    }
    // A timeline shorter than its viewport leaves nothing to scroll towards, so
    // the next block is built here rather than waiting for a scroll the reader
    // has no way to make.
    if (unbuilt > 0 && el.scrollHeight <= el.clientHeight) {
      buildOlder(unbuilt - OLDER_MESSAGES_STEP);
    }
  }, [unbuilt, buildOlder]);

  const followBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el === null || !pinnedToBottom.current) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  // Before the first paint, so a session opens showing its latest message
  // rather than the top of the conversation jumping down a frame later.
  useLayoutEffect(followBottom, [followBottom]);

  /**
   * Landing at the bottom is not one scroll but several: an opened session
   * keeps growing after it is laid out as images decode, older blocks are built
   * and the composer restores a draft that takes the height back. Each of those
   * leaves a reader who never scrolled short of the end, so the bottom is held
   * for as long as they are still at it.
   */
  useEffect(() => {
    const el = scrollRef.current;
    const content = contentRef.current;
    if (el === null || content === null) return;
    const observer = new ResizeObserver(followBottom);
    observer.observe(el);
    observer.observe(content);
    return () => observer.disconnect();
  }, [followBottom]);

  // Track whether the reader is at the bottom; only then auto-follow.
  const onScroll = () => {
    const el = scrollRef.current;
    if (el === null) return;
    pinnedToBottom.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (unbuilt > 0 && el.scrollTop < BUILD_OLDER_WITHIN_PX) {
      buildOlder(unbuilt - OLDER_MESSAGES_STEP);
    }
    queueSectionSync();
  };
  useEffect(() => {
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
    followBottom();
    queueSectionSync();
  }, [chat, followBottom, queueSectionSync]);

  // Regrouped only when the activity log changes, and reusing the array a turn
  // already had when its own entries did not — so a tool call landing in the
  // running turn leaves every other turn's row untouched. See
  // `groupActivitiesByTurn`.
  const previousGroups = useRef<ActivitiesByTurn>(new Map());
  const activitiesByTurn = useMemo(() => {
    const grouped = groupActivitiesByTurn(
      chat.activities,
      previousGroups.current
    );
    previousGroups.current = grouped;
    return grouped;
  }, [chat.activities]);

  const running = chat.latestTurn?.state === "running";
  const turnError =
    chat.latestTurn !== null && chat.latestTurn.state === "error"
      ? chat.latestTurn.errorMessage
      : null;

  const renderMessage = (message: ChatMessage) =>
    message.role === "user" ? (
      <UserMessage
        key={message.id}
        message={message}
        isSectionAnchor={sectionIds.has(message.id)}
      />
    ) : (
      <AssistantMessage
        key={message.id}
        message={message}
        activities={activitiesByTurn.get(message.turnId) ?? EMPTY_ACTIVITIES}
        streaming={message.streaming && running}
      />
    );

  return (
    <div className="@container relative flex min-h-0 flex-1 flex-col">
      <ScrollArea
        viewportRef={scrollRef}
        onViewportScroll={onScroll}
        className="min-h-0 flex-1"
        viewportClassName="scroll-fade overscroll-contain"
      >
        <div
          ref={contentRef}
          className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6"
        >
          {(unbuilt === 0 ? chat.messages : chat.messages.slice(unbuilt)).map(
            renderMessage
          )}
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
