/**
 * The way back down: it puts a full-page dock surface into the drawer again, on
 * the page it was expanded from.
 *
 * It rides the header, beside the project and the branch, rather than the surface
 * it acts on. How much of the window a surface is given is a fact about the
 * window — the same row that says which project and which branch you are looking
 * at — and the top of the frame is where the window is steered from. The expand
 * half of the pair is in the drawer's own strip because that strip is chrome of
 * the same kind, a seam's worth of it.
 */
import { IconArrowsDiagonalMinimize2 } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { restoreDock } from "@/components/layout/dock-expansion";
import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BottomTab } from "@/lib/ui-prefs";

const LABEL = "Collapse to bottom panel";

export function DockRestore({ tab }: { readonly tab: BottomTab }) {
  const navigate = useNavigate();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={LABEL}
            className="text-muted-foreground"
            onClick={() => restoreDock(navigate, tab)}
          />
        }
      >
        <IconArrowsDiagonalMinimize2 className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {LABEL}
        <KbdGroup>
          <Kbd>⌘</Kbd>
          <Kbd>B</Kbd>
        </KbdGroup>
      </TooltipContent>
    </Tooltip>
  );
}
