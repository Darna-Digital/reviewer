/**
 * A session row in the sidebar — one line, the title and nothing else, in the
 * ChatGPT shape: no agent mark, no branch, no message preview, no divider. What
 * the row drops is not lost, only moved behind hover, where the preview card
 * opens with the untruncated title, the tail of the conversation and the
 * session's metadata.
 *
 * The two dots the row does keep are the ones that change: the turn state, and
 * whether the session moved since you last looked.
 *
 * The list spans every project, so a row also says which one it came from —
 * but only while more than one is on screen. Narrowed to a single project, the
 * label would repeat what the filter already says, so it steps aside.
 *
 * ⌘-click is "open elsewhere", as everywhere else: the conversation is lifted
 * into a window tab of its own, which is where a session gets the full width.
 *
 * The conversation tail is fetched only once a card opens, so scrolling past a
 * hundred rows costs nothing.
 */
import { IconFolder, IconMessage, IconX } from "@tabler/icons-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import { agentLabel } from "@/interactions/threads/interfaces/agents";
import { openSessionTab } from "@/interactions/chats/functions/open-session-tab";
import type { ChatMessage, ChatSummary } from "@byconvo/core/chats";
import { useChatPreview } from "@/lib/queries";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

const HOVER_DELAY_MS = 120;
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
  showProject = false,
  onDelete,
}: {
  chat: ChatSummary;
  active: boolean;
  unread: boolean;
  /** Whether to name the session's project on the row. */
  showProject?: boolean;
  onDelete: () => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Opening a session shouldn't leave a preview of it hovering over the view —
  // a click closes the card and holds it shut until the pointer leaves.
  const clicked = useRef(false);
  // Fetched the moment the pointer lands rather than when the card opens, so the
  // hover delay doubles as load time and the card arrives with its tail already
  // in it instead of filling in after.
  const [primed, setPrimed] = useState(false);
  const preview = useChatPreview(chat.id, primed || open);
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
            onPointerEnter={() => setPrimed(true)}
            onPointerDown={() => {
              clicked.current = true;
              setOpen(false);
            }}
            onPointerLeave={() => {
              clicked.current = false;
            }}
            // The tab is opened here rather than left to the browser: a
            // ⌘-click on a link opens a window Electron would hand to the
            // system browser, which is not what "a tab of its own" means here.
            onClick={(event) => {
              if (!(event.metaKey || event.ctrlKey)) return;
              event.preventDefault();
              openSessionTab(chat.id, chat.title);
              void navigate({
                to: "/modes/agent-session/$chatId",
                params: { chatId: chat.id },
              });
            }}
            className={cn(
              "group/row flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-sm outline-none hover:bg-elevate focus-visible:bg-elevate",
              active && "bg-elevate-strong"
            )}
          />
        }
      >
        <TurnStateDot state={chat.turnState} />
        <span className="min-w-0 flex-1 truncate">{chat.title}</span>
        {showProject && (
          <span
            className="shrink-0 truncate text-xs text-muted-foreground group-hover/row:opacity-0"
            title={chat.origin.projectPath}
          >
            {chat.origin.projectName}
          </span>
        )}
        {/* The unread dot and the delete control share the same column: the
            dot steps aside the moment the row is hovered. */}
        <span className="relative size-4 shrink-0">
          {unread && (
            <span className="absolute inset-0 m-auto size-2 rounded-full bg-brand-500 group-hover/row:opacity-0" />
          )}
          <button
            type="button"
            aria-label="Delete session"
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
        <div className="flex items-center gap-1.5 border-t pt-2 text-xs text-muted-foreground">
          <IconMessage className="size-3.5 shrink-0" />
          <span className="tabular-nums">
            {chat.messageCount === 1
              ? "1 message"
              : `${chat.messageCount} messages`}
          </span>
          {/* Where the session's agent actually runs. In a project holding
              several git roots that is the part worth naming, so the root is
              shown whenever it isn't just the project over again. */}
          <span className="ml-auto flex min-w-0 items-center gap-1.5">
            <IconFolder className="size-3.5 shrink-0" />
            <span className="truncate" title={chat.origin.repoPath}>
              {chat.origin.repoName === chat.origin.projectName
                ? chat.origin.projectName
                : `${chat.origin.projectName}/${chat.origin.repoName}`}
            </span>
          </span>
        </div>
      </PreviewCardContent>
    </PreviewCard>
  );
}
