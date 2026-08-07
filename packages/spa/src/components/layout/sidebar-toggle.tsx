/**
 * SidebarToggle — shows or hides the shell's left sidebar (the file tree in
 * code mode, the collaboration nav in the other). It rides the window bar in
 * the native shell and the app's own toolbar in the browser, which has no
 * window bar to put it on.
 */
import {
  IconLayoutSidebar,
  IconLayoutSidebarFilled,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

export function SidebarToggle({ className }: { className?: string }) {
  const { sidebarVisible } = useUiPrefs();
  const label = sidebarVisible ? "Hide sidebar" : "Show sidebar";
  // The panel is filled while the sidebar is showing and hollow once it is put
  // away, so the glyph is a picture of the current layout rather than of what
  // the click will do — the button reads the same whether or not you remember
  // pressing it.
  const Glyph = sidebarVisible ? IconLayoutSidebarFilled : IconLayoutSidebar;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            aria-pressed={sidebarVisible}
            onClick={() => setUiPrefs({ sidebarVisible: !sidebarVisible })}
            className={cn(
              sidebarVisible ? "text-foreground" : "text-muted-foreground",
              className
            )}
          />
        }
      >
        <Glyph className="size-5" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}
