/**
 * ReviewAssignBar — a Figma-style floating bottom bar that appears while you have
 * local review comments (left in the commit/PR diff or a code view). It lets you
 * pick a target and hand the comments off: either start a fresh chat with a chosen
 * agent, or attach them to an existing session (chat) picked from a searchable
 * dropdown. Dismissable; it re-appears when you leave more.
 */
import {
  IconChevronDown,
  IconGitBranch,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { agentIcon } from "@/interactions/threads/components/agent-icons";
import { AgentGlyph } from "@/interactions/threads/components/agent-mark";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from "@/components/ui/preview-card";
import { isChatProviderKind } from "@/interactions/chats/functions/chat-assignment.functions";
import { AGENTS, agentLabel } from "@/interactions/threads/interfaces/agents";
import type { ChatProviderKind, ChatSummary } from "@byconvo/core/chats";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

/** Agent CLIs that can be assigned to chat flows (excludes the plain shell). */
const ASSIGNABLE = AGENTS.filter(
  (agent): agent is (typeof AGENTS)[number] & { kind: ChatProviderKind } =>
    isChatProviderKind(agent.kind)
);

const CommentCount = ({ count }: { count: number }) => (
  <>
    <span className="font-medium tabular-nums">{count}</span>
    <span className="font-normal text-muted-foreground">
      {count === 1 ? "comment" : "comments"}
    </span>
  </>
);

/** Where the review comments get handed off. */
export type AssignTarget =
  | { kind: "new"; agent: ChatProviderKind }
  | { kind: "existing"; chatId: string };

export function ReviewAssignBar({
  count,
  chats,
  onAssign,
  onDismiss,
  className,
  linkToComments = true,
}: {
  count: number;
  chats: ReadonlyArray<ChatSummary>;
  onAssign: (target: AssignTarget) => Promise<void> | void;
  onDismiss: () => void;
  /**
   * Where the bar sits. Defaults to the bottom of the window; a caller that
   * owns a panel of its own passes positioning that keeps the bar inside it.
   */
  className?: string;
  /**
   * Whether the count links to the review-comments page. False for comments
   * that page does not list — a link there would say they are somewhere they
   * are not.
   */
  linkToComments?: boolean;
}) {
  const [target, setTarget] = useState<AssignTarget>({
    kind: "new",
    agent: "claude",
  });
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const q = query.trim().toLowerCase();
  const agents = useMemo(
    () =>
      ASSIGNABLE.filter((a) => q === "" || a.label.toLowerCase().includes(q)),
    [q]
  );
  const sessions = useMemo(
    () =>
      chats.filter(
        (chat) =>
          q === "" ||
          chat.title.toLowerCase().includes(q) ||
          chat.branch.toLowerCase().includes(q)
      ),
    [chats, q]
  );

  const selectedChat =
    target.kind === "existing"
      ? (chats.find((c) => c.id === target.chatId) ?? null)
      : null;
  const targetAgent =
    target.kind === "new" ? target.agent : (selectedChat?.provider ?? "claude");
  // On the filled assign button the glyph rides the button's own foreground —
  // a brand colour there would fight the primary fill.
  const TargetIcon = agentIcon(targetAgent);
  const targetLabel =
    target.kind === "new"
      ? `New ${agentLabel(target.agent)} chat`
      : (selectedChat?.title ?? "Session");

  const pick = (next: AssignTarget) => {
    setTarget(next);
    setQuery("");
    setOpen(false);
  };

  const assign = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onAssign(target);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn(
        "pointer-events-none z-40 flex justify-center",
        className ?? "fixed inset-x-0 bottom-6"
      )}
    >
      <div className="pointer-events-auto flex animate-in items-center gap-2 rounded-full border bg-popover/95 py-1.5 pr-1.5 pl-1.5 shadow-lg ring-1 ring-foreground/5 backdrop-blur duration-150 fade-in slide-in-from-bottom-2">
        {linkToComments ? (
          <Link
            to="/modes/code/comments"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 gap-1 rounded-full px-3"
            )}
          >
            <CommentCount count={count} />
          </Link>
        ) : (
          <span className="flex h-8 items-center gap-1 px-3 text-sm">
            <CommentCount count={count} />
          </span>
        )}
        <div className="h-5 w-px bg-border" />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            className="flex h-8 w-auto max-w-56 min-w-40 items-center gap-1.5 rounded-full px-3 text-sm hover:bg-muted"
            aria-label="Assign target"
          >
            <AgentGlyph kind={targetAgent} className="size-4 shrink-0" />
            <span className="truncate">{targetLabel}</span>
            <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 gap-0 p-1">
            <div className="-mx-1 mb-1 flex items-center gap-2 border-b px-2.5 py-2">
              <IconSearch className="size-4 shrink-0 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search sessions…"
                className="h-auto rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
            </div>
            {/* Native overflow (not ScrollArea) so max-height actually scrolls —
                Base UI ScrollArea's size-full viewport won't constrain under a
                max-h parent, so content is clipped with nowhere to scroll. */}
            <div className="scroll-fade max-h-64 min-w-0 overflow-x-hidden overflow-y-auto">
              {agents.length > 0 && (
                <div className="px-2 pt-1 pb-0.5 text-xs text-muted-foreground">
                  New chat
                </div>
              )}
              {agents.map((a) => {
                const active = target.kind === "new" && target.agent === a.kind;
                return (
                  <button
                    key={a.kind}
                    type="button"
                    onClick={() => pick({ kind: "new", agent: a.kind })}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
                      active && "bg-muted"
                    )}
                  >
                    <AgentGlyph kind={a.kind} className="size-4 shrink-0" />
                    <span className="truncate">{a.label}</span>
                  </button>
                );
              })}
              {sessions.length > 0 && (
                <div className="px-2 pt-2 pb-1 text-xs text-muted-foreground">
                  Sessions
                </div>
              )}
              {sessions.map((chat) => (
                <SessionRow
                  key={chat.id}
                  chat={chat}
                  active={
                    target.kind === "existing" && target.chatId === chat.id
                  }
                  onSelect={() => pick({ kind: "existing", chatId: chat.id })}
                />
              ))}
              {agents.length === 0 && sessions.length === 0 && (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No matches
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          className="rounded-full"
          disabled={busy}
          onClick={() => void assign()}
        >
          <TargetIcon className="size-4" />
          {busy
            ? "Starting…"
            : target.kind === "new"
              ? "Assign to fix"
              : "Send to session"}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 rounded-full"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <IconX className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * A session row in the picker. Hovering opens a side preview card with the full
 * title and session metadata — same elevated panel language as the Cursor-style
 * hover previews, rather than a tiny tooltip bubble.
 */
function SessionRow({
  chat,
  active,
  onSelect,
}: {
  chat: ChatSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <PreviewCard>
      <PreviewCardTrigger
        delay={400}
        closeDelay={100}
        render={
          <button
            type="button"
            onClick={onSelect}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted",
              active && "bg-muted"
            )}
          />
        }
      >
        <AgentGlyph kind={chat.provider} className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{chat.title}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {chat.branch}
        </span>
      </PreviewCardTrigger>
      <PreviewCardContent side="right" align="start" className="p-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 leading-snug font-medium">
            {chat.title}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timeAgo(chat.updatedAt)}
          </span>
        </div>
        <div className="flex flex-col gap-1 text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1.5">
            <IconGitBranch className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">{chat.branch}</span>
          </div>
          <div className="flex min-w-0 items-center gap-1.5">
            <AgentGlyph kind={chat.provider} className="size-3.5 shrink-0" />
            <span className="min-w-0 truncate">
              {agentLabel(chat.provider)}
            </span>
          </div>
        </div>
      </PreviewCardContent>
    </PreviewCard>
  );
}
