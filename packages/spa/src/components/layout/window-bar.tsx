/**
 * WindowBar — the strip along the top of the window: the macOS traffic lights,
 * the tab strip, the window menu and the account.
 *
 * Drawn in both shells, so the app reads the same either way. Two things are
 * the native window's alone: the lead gutter the traffic lights are drawn into,
 * and the drag region — empty space moves the window, and every control opts
 * back out of it.
 */
// The history arrows are parked for now, along with the icons they wore.
// import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { IconCommand, IconDotsVertical } from "@tabler/icons-react";
// import { useCanGoBack } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BarLabel, NO_DRAG } from "@/components/layout/bar-controls";
import { WindowTabStrip } from "@/interactions/window-tabs/components/window-tab-strip";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import {
  setProjectPickerOpen,
  useProjectPickerOpen,
} from "@/interactions/workspace/adapters/project-picker.store";
import { ProjectPicker } from "@/interactions/workspace/components/project-picker";
import { openSearch } from "@/interactions/search/adapters/search.store";
import { isDesktop } from "@/lib/desktop";
import { useWorkspace } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * How much of the bar the window's own controls have.
 *
 * macOS holds the lights 20px off the window's edge, and they run 52px wide, so
 * they end at 72. The gutter gives the group that same 20px on its other side:
 * the lights are a thing on the bar with equal air either way round, rather than
 * a thing the bar starts after.
 *
 * The 20 is measured to the edge of the first control, not to the mark inside
 * it — a chip's fill is what stands next to the lights. That edge is the row's
 * own gap along from the gutter, so the gutter is 92 less those 4.
 */
const LEAD_GUTTER = "w-22";

/**
 * A row of the window menu: its icon and its name. The chords are the native
 * shell's, so no keycaps are written on the bar.
 */
function MenuRow({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  /** The row's icon; the label follows it. */
  children: React.ReactNode;
}) {
  return (
    <DropdownMenuItem onClick={onClick}>
      {children}
      {label}
    </DropdownMenuItem>
  );
}

export function WindowBar() {
  // const canGoBack = useCanGoBack();
  const workspace = useWorkspace();
  const pickerOpen = useProjectPickerOpen();

  return (
    <header
      className={cn(
        // 46px: the 36px band every surface keeps, with 5px of frame above and
        // below it. Its middle is 23, which is where the traffic lights sit —
        // macOS lands a light on an even pixel, so the centre of a 14px one
        // falls on an odd pixel, and only every fourth height puts the bar's own
        // middle there to meet it. The row rides a pixel below that line: the
        // lights are circles among squares and read low against them at a true
        // 23, so the squares give way rather than the bar being rebuilt around
        // a line the lights cannot reach.
        "flex h-11.5 shrink-0 items-center pt-0.5",
        isDesktop && "[-webkit-app-region:drag]"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1">
        {/* The traffic lights are drawn by macOS over the bar's top-left, so the
            lead gutter is what the window's own controls sit in (see
            the shell's window). A browser tab has no controls there, so the
            bar starts at its edge. */}
        <div
          aria-hidden
          className={cn("shrink-0", isDesktop ? LEAD_GUTTER : "w-2")}
        />
        <SidebarToggle className={NO_DRAG} />
        {/* <BarButton
        label="Back"
        disabled={!canGoBack}
        onClick={() => router.history.back()}
      >
        <IconArrowLeft className="size-5" />
      </BarButton>
      <BarButton label="Forward" onClick={() => router.history.forward()}>
        <IconArrowRight className="size-5" />
      </BarButton> */}

        {/* The project the window is on leads the strip: every tab behind it is
            a place within that project, so the chip names them all rather than
            being one more thing on the page under them. Switching project
            lands in the arriving project's tree, as it always has. */}
        <div className={cn("flex min-w-0 shrink-0", NO_DRAG)}>
          <ProjectPicker
            workspace={workspace.data}
            open={pickerOpen}
            onOpenChange={setProjectPickerOpen}
            onWindowBar
            tooltip={<BarLabel label="Projects" />}
          />
        </div>

        <WindowTabStrip />
      </div>
      {/* The trailing end keeps its content whatever the window's width: it is
          the strip that gives way first. Its inset is a gutter like the lead
          one rather than padding, so both ends of the bar read the same. */}
      <div className="flex shrink-0 items-center justify-end gap-1">
        {/* The window menu: each row names itself. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Window menu"
                className={cn("text-muted-foreground", NO_DRAG)}
              />
            }
          >
            <IconDotsVertical className="size-4" />
          </DropdownMenuTrigger>

          {/* Narrower than a menu's default: these rows are short names. */}
          <DropdownMenuContent align="end" className="min-w-48">
            <MenuRow
              label="Command menu"
              onClick={() => openSearch("commands")}
            >
              <IconCommand className="size-4 shrink-0" />
            </MenuRow>
          </DropdownMenuContent>
        </DropdownMenu>
        <div aria-hidden className="w-2 shrink-0" />
      </div>
    </header>
  );
}
