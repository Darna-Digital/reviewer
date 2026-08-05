/** Collaboration mode's inbox button, on the prototype's mock threads. */
import { IconSend } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import {
  INBOX_PREVIEW_COUNT,
  InboxPopover,
  InboxPopoverHeader,
  inboxPopoverLink,
} from "@/components/layout/inbox-popover"
import { Avatar } from "@/components/ui/avatar"
import { INBOX_ITEMS, UNREAD_COUNT } from "@/interactions/inbox/data/inbox.mock"

export function MockInboxPopover({
  active,
  side,
}: {
  active: boolean
  side?: "right" | "bottom"
}) {
  return (
    <InboxPopover active={active} side={side} waiting={UNREAD_COUNT > 0}>
      {(close) => (
        <>
          <InboxPopoverHeader>
            <Link
              to="/modes/collaboration/inbox"
              onClick={close}
              className={inboxPopoverLink}
            >
              All messages
            </Link>
            <Link
              to="/modes/collaboration/inbox"
              search={{ compose: "chat" }}
              onClick={close}
              className={`ml-auto flex items-center gap-1.5 ${inboxPopoverLink}`}
            >
              <IconSend className="size-3.5" />
              New message
            </Link>
          </InboxPopoverHeader>

          <ul role="list" className="flex flex-col">
            {INBOX_ITEMS.slice(0, INBOX_PREVIEW_COUNT).map((item) => (
              <li key={item.id} className="border-b last:border-b-0">
                <Link
                  to="/modes/collaboration/inbox"
                  onClick={close}
                  className="flex gap-2.5 px-3 py-2.5 outline-none hover:bg-elevate focus-visible:bg-elevate"
                >
                  <Avatar name={item.author} className="size-6" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate text-[13px] font-medium">
                        {item.author}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        #{item.channel}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {item.time}
                      </span>
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] text-muted-foreground">
                      {item.preview}
                    </span>
                  </span>
                  {item.unread && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sky-500" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </InboxPopover>
  )
}
