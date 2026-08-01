/**
 * SidebarToggle — shows or hides the shell's left sidebar (the file tree in
 * code mode, the collaboration nav in the other). It rides the window bar in
 * the native shell and the app's own toolbar in the browser, which has no
 * window bar to put it on.
 */
import { IconLayoutSidebar } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"

export function SidebarToggle({ className }: { className?: string }) {
  const { sidebarVisible } = useUiPrefs()
  const label = sidebarVisible ? "Hide sidebar" : "Show sidebar"

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            onClick={() => setUiPrefs({ sidebarVisible: !sidebarVisible })}
            className={cn("rounded-lg text-muted-foreground", className)}
          />
        }
      >
        <IconLayoutSidebar className="size-4.5" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
