/**
 * SidebarToggle — the way back to the shell's left sidebar (the file tree in
 * code mode, the collaboration nav in the other). The sidebar is put away by
 * dragging its edge shut rather than by a button, so while it is showing there
 * is nothing here to press and the button stays out of the bar; it appears
 * once the sidebar is gone. It rides the window bar, in either shell.
 */
import { IconLayoutSidebar } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

const LABEL = "Show sidebar";

export function SidebarToggle({ className }: { className?: string }) {
  const { sidebarVisible } = useUiPrefs();
  if (sidebarVisible) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={LABEL}
            onClick={() => setUiPrefs({ sidebarVisible: true })}
            className={cn("text-muted-foreground", className)}
          />
        }
      >
        <IconLayoutSidebar className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{LABEL}</TooltipContent>
    </Tooltip>
  );
}
