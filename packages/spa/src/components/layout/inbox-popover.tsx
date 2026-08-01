/**
 * The inbox button both modes wear: it opens onto the last few messages and a
 * composer, so a reply never costs the surface you are on.
 */
import { IconInbox, IconSend } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { Avatar } from "@/components/ui/avatar"
import { buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { INBOX_ITEMS, UNREAD_COUNT } from "@/interactions/inbox/data/inbox.mock"
import { cn } from "@/lib/utils"

const PREVIEW_COUNT = 4

export function InboxPopover({
  active,
  side = "right",
}: {
  active: boolean
  /** "right" hangs it off the rail; "bottom" off a title-bar button. */
  side?: "right" | "bottom"
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* The rail sizes its buttons a step up from the toolbar's, so the inbox
          matches whichever it is standing in rather than one of the two. */}
      <PopoverTrigger
        className={cn(
          buttonVariants({
            variant: "ghost",
            size: side === "right" ? "icon" : "icon-sm",
          }),
          "relative rounded-lg text-muted-foreground [-webkit-app-region:no-drag]",
          (active || open) && "bg-muted text-foreground"
        )}
        aria-label="Inbox"
      >
        <IconInbox className={side === "right" ? "size-5" : "size-4.5"} />
        {UNREAD_COUNT > 0 && (
          <span
            className={cn(
              "absolute size-1.5 rounded-full bg-sky-500",
              side === "right" ? "top-1 right-1" : "top-0.5 right-0.5"
            )}
          />
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className="w-96 gap-0 overflow-hidden p-0"
      >
        <div className="flex h-9 items-center gap-2 border-b px-3">
          <p className="text-[13px] font-medium">Inbox</p>
          <Link
            to="/inbox"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            All messages
          </Link>
          <Link
            to="/inbox"
            search={{ compose: "chat" }}
            onClick={() => setOpen(false)}
            className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            <IconSend className="size-3.5" />
            New message
          </Link>
        </div>

        <ul role="list" className="flex flex-col">
          {INBOX_ITEMS.slice(0, PREVIEW_COUNT).map((item) => (
            <li key={item.id} className="border-b last:border-b-0">
              <Link
                to="/inbox"
                onClick={() => setOpen(false)}
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
      </PopoverContent>
    </Popover>
  )
}
