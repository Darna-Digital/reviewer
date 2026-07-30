/**
 * The inbox button both modes wear: it opens onto the last few messages and a
 * composer, so a reply never costs the surface you are on.
 */
import { IconInbox, IconSend } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { Avatar } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { AGENTS } from "@/interactions/collaboration/data/collaboration.mock"
import { INBOX_ITEMS, UNREAD_COUNT } from "@/interactions/inbox/data/inbox.mock"
import { cn } from "@/lib/utils"

const PREVIEW_COUNT = 4

export function InboxPopover({ active }: { active: boolean }) {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const agent = AGENTS[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative rounded-lg text-muted-foreground [-webkit-app-region:no-drag]",
          (active || open) && "bg-muted text-foreground"
        )}
        aria-label="Inbox"
      >
        <IconInbox className="size-5" />
        {UNREAD_COUNT > 0 && (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-sky-500" />
        )}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-96 gap-0 overflow-hidden p-0"
      >
        <div className="flex h-9 items-center gap-2 border-b px-3">
          <p className="text-[13px] font-medium">Inbox</p>
          <span className="text-xs text-muted-foreground tabular-nums">
            {UNREAD_COUNT} unread
          </span>
          <Link
            to="/inbox"
            onClick={() => setOpen(false)}
            className="ml-auto text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            Open inbox
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

        <div className="flex items-center gap-1.5 border-t p-2">
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={`Ask ${agent?.name ?? "an agent"} to do something`}
            className="h-8 min-w-0 flex-1 bg-transparent px-1.5 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <Button
            size="icon-sm"
            className="rounded-full"
            disabled={message.trim().length === 0}
            aria-label="Send message"
          >
            <IconSend className="size-4" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
