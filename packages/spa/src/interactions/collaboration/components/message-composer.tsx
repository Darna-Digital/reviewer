import {
  IconSend,
  IconAt,
  IconMoodSmile,
  IconPaperclip,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

/** The reply box shared by the channel panes and the inbox thread. */
export function MessageComposer({ placeholder }: { placeholder: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4">
      <div className="rounded-xl shadow-surface-2 focus-within:ring-3 focus-within:ring-ring/25">
        <input
          aria-label={placeholder}
          placeholder={placeholder}
          className="h-10 w-full bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-2 px-3 pb-2 text-muted-foreground">
          <IconAt className="size-4" />
          <IconPaperclip className="size-4" />
          <IconMoodSmile className="size-4" />
          <Button
            size="icon-sm"
            className="ml-auto rounded-full"
            aria-label="Send message"
          >
            <IconSend className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
