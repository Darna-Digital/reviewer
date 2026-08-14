/**
 * Code mode's inbox button — the repo's real agent threads, newest first, with
 * the same panel the collaboration prototype wears. Opening it clears the dot:
 * the mark it compares against moves to now once the panel closes.
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
import { isChatUnread } from "@/interactions/chats/functions/chat-unread.functions";
import { useRecentChats } from "@/lib/queries";
import { timeAgo } from "@/lib/relative-time";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";

export function ChatsInboxPopover({ active }: { active: boolean }) {
  const seenAt = useUiPrefs().inboxSeenAt;
  const chats = useRecentChats().data?.items ?? [];
  const unread = chats.filter((chat) => isChatUnread(chat, seenAt));

  return (
    <InboxPopover
      active={active}
      waiting={unread.length > 0}
      onClose={() => setUiPrefs({ inboxSeenAt: new Date().toISOString() })}
    >
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
              className={`ml-auto flex items-center gap-1.5 ${inboxPopoverLink}`}
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
                    {isChatUnread(chat, seenAt) && (
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
