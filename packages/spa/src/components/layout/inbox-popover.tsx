/**
 * The inbox button both modes wear: it opens onto the last few messages and a
 * composer, so a reply never costs the surface you are on. Each mode fills the
 * panel with its own rows — collaboration's prototype threads, code mode's
 * agent chats — so this only carries the chrome the two share.
 */
import { IconInbox } from "@tabler/icons-react"
import { useState, type ReactNode } from "react"
import { buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export const INBOX_PREVIEW_COUNT = 4

export const inboxPopoverLink =
  "text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"

export function InboxPopoverHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-9 items-center gap-2 border-b px-3">
      <p className="text-[13px] font-medium">Inbox</p>
      {children}
    </div>
  )
}

export function InboxPopover({
  active,
  side = "right",
  waiting,
  onClose,
  children,
}: {
  active: boolean
  /** "right" hangs it off the rail; "bottom" off a title-bar button. */
  side?: "right" | "bottom"
  /** Draws the dot on the button — something in the list wants a look. */
  waiting: boolean
  /** Fired once the panel is dismissed, so a mode can mark the list seen. */
  onClose?: () => void
  children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const close = () => {
    setOpen(false)
    onClose?.()
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative rounded-lg text-muted-foreground [-webkit-app-region:no-drag]",
          (active || open) && "bg-muted text-foreground"
        )}
        aria-label="Inbox"
      >
        <IconInbox className="size-5" />
        {waiting && (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-sky-500" />
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className="w-96 gap-0 overflow-hidden p-0"
      >
        {children(close)}
      </PopoverContent>
    </Popover>
  )
}
