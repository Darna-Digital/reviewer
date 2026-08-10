/**
 * A thread row in code mode's inbox — the same shape the collaboration inbox
 * uses: the agent's mark, the title and when it last moved, the branch it runs
 * on, and two lines of the last message. Hovering opens a side preview card
 * with the untruncated title, the tail of the conversation and the session's
 * metadata — the same elevated panel language as the review bar's session
 * previews, rather than a tiny tooltip bubble.
 *
 * The conversation tail is fetched only once a card opens, so scrolling past a
 * hundred rows costs nothing.
 */
import { IconGitBranch, IconMessage, IconX } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import {
  AgentGlyph,
  AgentMark,
} from "@/interactions/threads/components/agent-mark";
import { agentLabel } from "@/interactions/threads/interfaces/agents";
import type { ChatMessage, ChatSummary } from "@byconvo/core/chats";
import { useChatPreview } from "@/lib/queries";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const HOVER_DELAY_MS = 400;
const HOVER_CLOSE_DELAY_MS = 100;
const PREVIEW_TURNS = 3;

export function TurnStateDot({ state }: { state: ChatSummary["turnState"] }) {
  if (state === null || state === "completed") return null;
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
  );
}

function ConversationTail({
  messages,
  assistantLabel,
}: {
  messages: ReadonlyArray<ChatMessage>;
  assistantLabel: string;
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
  );
}

export function ChatRow({
  chat,
  active,
  unread,
  onDelete,
}: {
  chat: ChatSummary;
  active: boolean;
  unread: boolean;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  // Opening a thread shouldn't leave a preview of it hovering over the view —
  // a click closes the card and holds it shut until the pointer leaves.
  const clicked = useRef(false);
  const preview = useChatPreview(chat.id, open);
  const assistantLabel = agentLabel(chat.provider);

  const tail = (preview.data?.messages ?? [])
    .filter((m) => m.text.trim().length > 0)
    .slice(-PREVIEW_TURNS);

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
            to="/modes/agent-session/$chatId"
            params={{ chatId: chat.id }}
            onPointerDown={() => {
              clicked.current = true;
              setOpen(false);
            }}
            onPointerLeave={() => {
              clicked.current = false;
            }}
            className={cn(
              "group/row flex w-full gap-2.5 border-b px-3 py-2.5 text-left outline-none hover:bg-elevate focus-visible:bg-elevate",
              active && "bg-muted"
            )}
          />
        }
      >
        <AgentMark kind={chat.provider} className="mt-0.5 size-7 rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <TurnStateDot state={chat.turnState} />
            <span className="truncate text-[13px] font-medium">
              {chat.title}
            </span>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              {timeAgo(chat.updatedAt)}
            </span>
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            {assistantLabel}
            <span className="min-w-0 truncate rounded bg-elevate px-1 py-px text-foreground">
              {chat.branch}
            </span>
          </span>
          {chat.lastMessage !== null && chat.lastMessage.length > 0 && (
            <span className="mt-1 line-clamp-2 block text-[13px] text-muted-foreground">
              {chat.lastMessage}
            </span>
          )}
        </span>
        {/* The unread dot and the delete control share the same column: the
            dot steps aside the moment the row is hovered. */}
        <span className="relative mt-1.5 size-4 shrink-0">
          {unread && (
            <span className="absolute inset-0 m-auto size-2 rounded-full bg-sky-500 group-hover/row:opacity-0" />
          )}
          <button
            type="button"
            aria-label="Delete thread"
            className="absolute inset-0 grid place-items-center text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 hover:text-destructive"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
          >
            <IconX className="size-3.5" />
          </button>
        </span>
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
            <p className="line-clamp-3 text-xs leading-relaxed break-words text-muted-foreground">
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
            <AgentGlyph kind={chat.provider} className="size-3.5 shrink-0" />
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
  );
}
