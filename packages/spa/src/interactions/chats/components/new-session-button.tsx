/**
 * Start a session, from the toolbar's left edge — where collaboration mode puts
 * its own "new task", so the first thing in the bar is the thing that makes one.
 */
import { IconPencilPlus } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NEW_SESSION,
  setChatMode,
} from "@/interactions/chats/adapters/chat-mode.store";

export function NewSessionButton() {
  const navigate = useNavigate();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="New session"
            className="rounded-lg text-muted-foreground"
            // A session minted here is for building, whatever the last one
            // opened from the analysis pane was for.
            onClick={() => {
              setChatMode(NEW_SESSION, "build");
              void navigate({
                to: "/modes/agent-session",
                search: { new: true },
              });
            }}
          />
        }
      >
        <IconPencilPlus className="size-5" />
      </TooltipTrigger>
      <TooltipContent side="bottom">New session</TooltipContent>
    </Tooltip>
  );
}
