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
 * The list spans every project, but which one a session came from is the card's
 * to say, not the row's — a name on every row is noise on all of them.
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
import { Button } from "@/components/ui/button";
import { Orb } from "@/components/ui/orb";
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
    // A settled turn is a dot and a running one is the orb, so the two sit in
    // the same box — the title starts at one place whatever the row is saying.
    <span className="flex size-3.5 shrink-0 items-center justify-center">
      {state === "running" ? (
        <Orb size={14} label="turn running" />
      ) : (
        <span
          className={cn(
            "size-1.5 rounded-full",
            state === "error" ? "bg-destructive" : "bg-brand-500"
          )}
          aria-label={`turn ${state}`}
        />
      )}
    </span>
  );
}

/**
 * The tail read as a conversation rather than a list of labelled turns: what
 * you said sits in a bubble on the right, what the agent said runs plain across
 * the card, and everything before the last agent line is dimmed — the shape
 * carries the roles, so the names come off. Only the reader who cannot see the
 * shape still gets them.
 */
function ConversationTail({
  messages,
  assistantLabel,
}: {
  messages: ReadonlyArray<ChatMessage>;
  assistantLabel: string;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      {messages.map((m, i) => {
        const speaker = (
          <span className="sr-only">
            {m.role === "user" ? "You" : assistantLabel}:{" "}
          </span>
        );
        return m.role === "user" ? (
          <p
            key={m.id}
            className="line-clamp-2 max-w-[85%] self-end rounded-lg rounded-br-sm bg-elevate px-2 py-1 text-xs leading-relaxed break-words"
          >
            {speaker}
            {m.text}
          </p>
        ) : (
          <p
            key={m.id}
            className={cn(
              "line-clamp-2 max-w-[92%] text-xs leading-relaxed break-words",
              i === messages.length - 1
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            {speaker}
            {m.text}
          </p>
        );
      })}
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
        {/* The unread dot and the delete control share the same column: the
            dot steps aside the moment the row is hovered. */}
        <span
          className={cn(
            "relative h-7 shrink-0 overflow-hidden transition-[width,margin] duration-160 ease-out",
            unread
              ? "-mr-1 w-7"
              : "w-0 group-hover/row:-mr-1 group-hover/row:w-7 focus-within:-mr-1 focus-within:w-7"
          )}
        >
          {unread && (
            <span className="absolute inset-0 m-auto size-2 rounded-full bg-brand-500 transition-opacity duration-160 ease-out group-hover/row:opacity-0" />
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete session"
            className="absolute inset-0 text-muted-foreground opacity-0 transition-[background,box-shadow,color,opacity] duration-160 ease-out group-hover/row:opacity-100 hover:text-destructive focus-visible:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
          >
            <IconX className="size-3.5" />
          </Button>
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
          <span className="whitespace-nowrap tabular-nums">
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
