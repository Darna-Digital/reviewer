/**
 * Code mode's inbox button — the repo's real agent threads, newest first, with
 * the same panel the collaboration prototype wears. The dot stands for threads
 * that have moved since they were last opened, so it is opening a thread that
 * puts it out — glancing at the panel is not reading them. See
 * `chats.attention.ts`.
 */
import { IconPlus } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import {
  INBOX_PREVIEW_COUNT,
  InboxPopover,
  InboxPopoverHeader,
  inboxPopoverLink,
} from "@/components/layout/inbox-popover";
import { AgentMark } from "@/interactions/threads/components/agent-mark";
import { isChatUnread } from "@reviewer/core/chats";
import { useRecentChats } from "@/lib/queries";
import { timeAgo } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

export function ChatsInboxPopover({ active }: { active: boolean }) {
  const chats = useRecentChats().data?.items ?? [];
  const unread = chats.filter(isChatUnread);

  return (
    <InboxPopover active={active} waiting={unread.length > 0}>
      {(close) => (
        <>
          <InboxPopoverHeader>
            <Link
              to="/modes/agent-session"
              onClick={close}
              className={inboxPopoverLink}
            >
              All threads
            </Link>
            <Link
              to="/modes/agent-session"
              search={{ new: true }}
              onClick={close}
              className={cn(
                "ml-auto flex items-center gap-1.5",
                inboxPopoverLink
              )}
            >
              <IconPlus className="size-3.5" />
              New thread
            </Link>
          </InboxPopoverHeader>

          {chats.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No threads yet. Send a message to start one.
            </p>
          ) : (
            <ul role="list" className="flex flex-col">
              {chats.slice(0, INBOX_PREVIEW_COUNT).map((chat) => (
                <li key={chat.id} className="border-b last:border-b-0">
                  <Link
                    to="/modes/agent-session/$chatId"
                    params={{ chatId: chat.id }}
                    onClick={close}
                    className="flex gap-2.5 px-3 py-2.5 outline-none hover:bg-elevate focus-visible:bg-elevate"
                  >
                    <AgentMark kind={chat.provider} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className="truncate text-[13px] font-medium">
                          {chat.title}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {timeAgo(chat.updatedAt)}
                        </span>
                      </span>
                      {chat.lastMessage !== null &&
                        chat.lastMessage.length > 0 && (
                          <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted-foreground">
                            {chat.lastMessage}
                          </span>
                        )}
                    </span>
                    {isChatUnread(chat) && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand-500" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </InboxPopover>
  );
}
