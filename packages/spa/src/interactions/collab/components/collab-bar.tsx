/**
 * The hovering bar — three shortcuts, floating over the foot of the page.
 *
 * Basecamp puts these along the bottom of the window as plain links in a
 * footer. That reads as the edge of the page, which is exactly what this is
 * not: it is the same three things wherever you are, so it floats clear of the
 * page instead of being ruled off from it — a pill on the frame's own material,
 * standing on nothing, the way the launchpad's collapse tab does.
 *
 * It is `fixed` rather than laid out at the end of the column because the
 * column scrolls and these do not, and because a page that had to leave room
 * for it would be a page that knows about it. The column's own bottom padding
 * is what keeps its last row from ending up underneath.
 */
import {
  IconBookmark,
  IconChecklist,
  IconNote,
  type IconProps,
} from "@tabler/icons-react";
import type { ComponentType } from "react";
import { Kbd } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { CollabPanel } from "../interfaces/collab.interfaces";
import { COLLAB_SHORTCUTS } from "../functions/collab-layout.functions";
import {
  pressCollabShortcut,
  useCollabDrawer,
} from "../adapters/collab-drawer.store";

const ICONS: Record<CollabPanel, ComponentType<IconProps>> = {
  tasks: IconChecklist,
  bookmarks: IconBookmark,
  notes: IconNote,
};

/** The digit each shortcut answers to — see `collab-shell` for the listener. */
const DIGIT: Record<CollabPanel, string> = {
  tasks: "1",
  bookmarks: "2",
  notes: "3",
};

export function CollabBar() {
  const open = useCollabDrawer();

  return (
    <div
      className={cn(
        // Absolute within the shell, for the reason the drawer is — see
        // `collab-drawer`.
        "pointer-events-none absolute inset-x-0 z-30 flex justify-center",
        // Above the drawer when one is up, so the bar reads as the thing that
        // raised it rather than as something the drawer covered.
        open === null
          ? "bottom-5"
          : "bottom-[calc(var(--collab-drawer)+1.25rem)]",
        "transition-[bottom] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
      )}
    >
      <nav
        aria-label="My stuff"
        className="pointer-events-auto flex items-center gap-0.5 rounded-full border bg-surface-4/85 p-1 shadow-surface-5 backdrop-blur-md"
      >
        {COLLAB_SHORTCUTS.map(({ panel, label }) => {
          const Icon = ICONS[panel];
          const active = open === panel;
          return (
            <Tooltip key={panel}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => pressCollabShortcut(panel)}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors outline-none",
                      "focus-visible:ring-3 focus-visible:ring-ring/30",
                      active
                        ? "bg-elevate-strong text-foreground"
                        : "text-muted-foreground hover:bg-elevate hover:text-foreground"
                    )}
                  />
                }
              >
                <Icon className="size-4" />
                {label}
              </TooltipTrigger>
              <TooltipContent side="top">
                {label}
                <Kbd>⌥{DIGIT[panel]}</Kbd>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </div>
  );
}
