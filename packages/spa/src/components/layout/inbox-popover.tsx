/**
 * The inbox button: it opens onto the last few messages and a composer, so a
 * reply never costs the surface you are on. The caller fills the panel with
 * its own rows — the app's agent chats — so this only carries the chrome.
 */
import { IconInbox } from "@tabler/icons-react";
import { useRef, useState, type ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const INBOX_PREVIEW_COUNT = 4;

const HOVER_OPEN_DELAY = 150;
const HOVER_CLOSE_DELAY = 200;

export const inboxPopoverLink =
  "text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground";

export function InboxPopoverHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-9 items-center gap-2 border-b px-3">
      <p className="text-[13px] font-medium">Inbox</p>
      {children}
    </div>
  );
}

export function InboxPopover({
  active,
  side = "right",
  waiting,
  children,
}: {
  active: boolean;
  /** "right" hangs it off the rail; "bottom" off a title-bar button. */
  side?: "right" | "bottom";
  /** Draws the dot on the button — something in the list wants a look. */
  waiting: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const holdsFocus = useRef(false);
  const close = () => {
    holdsFocus.current = false;
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (!next && details.reason === "trigger-hover" && holdsFocus.current) {
          details.cancel();
          return;
        }
        return next ? setOpen(true) : close();
      }}
    >
      <PopoverTrigger
        openOnHover
        delay={HOVER_OPEN_DELAY}
        closeDelay={HOVER_CLOSE_DELAY}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative text-muted-foreground [-webkit-app-region:no-drag]",
          (active || open) && "bg-muted text-foreground"
        )}
        aria-label="Inbox"
      >
        <IconInbox className="size-5" />
        {waiting && (
          <span className="absolute top-1 right-1 size-1.5 rounded-full bg-brand-500" />
        )}
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className="w-96 gap-0 overflow-hidden p-0"
        onFocusCapture={() => {
          holdsFocus.current = true;
        }}
        onBlurCapture={(event) => {
          holdsFocus.current = event.currentTarget.contains(
            event.relatedTarget
          );
        }}
      >
        {children(close)}
      </PopoverContent>
    </Popover>
  );
}
