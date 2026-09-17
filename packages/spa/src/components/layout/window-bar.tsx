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
import {
  IconCommand,
  IconDotsVertical,
  IconLayoutGrid,
  IconSitemap,
  IconWorld,
} from "@tabler/icons-react";
// import { useCanGoBack } from "@tanstack/react-router";
import { useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarButton,
  BarLabel,
  NO_DRAG,
  Shortcut,
} from "@/components/layout/bar-controls";
import { WindowTabStrip } from "@/interactions/window-tabs/components/window-tab-strip";
import {
  barShortcut,
  type BarPane,
  type BarShortcut,
} from "@/components/layout/window-bar.shortcuts";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import {
  toggleTabOverview,
  useTabOverview,
} from "@/interactions/tab-preview/adapters/tab-overview.store";
import {
  setProjectPickerOpen,
  useProjectPickerOpen,
} from "@/interactions/workspace/adapters/project-picker.store";
import { ProjectPicker } from "@/interactions/workspace/components/project-picker";
import { ROW_TOOLTIP_PLACEMENT } from "@/components/ui/truncated-text";
import { openSearch } from "@/interactions/search/adapters/search.store";
import { isDesktop } from "@/lib/desktop";
import { isCodeSurface } from "@/lib/shell-route";
import { useWorkspace } from "@/lib/queries";
import { toggleSidePane } from "@/lib/ui-prefs";
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

/** Stay on the page the project was switched from, now scoped to the new one. */
const stayPut = () => {};

const PROJECT_PICKER_KEYS = "⌘⇧P";
const LAUNCHPAD_KEYS = "⌘L";
const COMMANDS_KEYS = "⌘K";
const ANALYSIS_KEYS = "⌘⇧A";
const BROWSER_KEYS = "⌘⇧B";

/** The chords that are the bar's to answer; the strip answers its own. */
const BAR_SHORTCUTS: ReadonlySet<BarShortcut["kind"]> = new Set<
  BarShortcut["kind"]
>(["project-picker", "pane"]);

/**
 * A row of the window menu: its name, and its chord on hover rather than set
 * along the row. The keycaps are cut for a tooltip's surface, and a menu that
 * held them would be a second place on the bar where a chord is written — so
 * the row says what it does and the tooltip says how else to do it, exactly as
 * the buttons either side of the strip do.
 */
function MenuRow({
  label,
  keys,
  onClick,
  children,
}: {
  label: string;
  keys: string;
  onClick: () => void;
  /** The row's icon; the label follows it. */
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<DropdownMenuItem onClick={onClick} />}>
        {children}
        {label}
      </TooltipTrigger>
      {/* Flush off the row's edge, where every other row tooltip in the app
          sits, so it never covers the rows under it. */}
      <TooltipContent {...ROW_TOOLTIP_PLACEMENT}>
        {label}
        <Shortcut keys={keys} />
      </TooltipContent>
    </Tooltip>
  );
}

export function WindowBar() {
  // const canGoBack = useCanGoBack();
  const location = useRouterState({ select: (s) => s.location });
  const overviewOpen = useTabOverview();

  const inCodeMode = isCodeSurface(location.pathname);
  const workspace = useWorkspace();
  const pickerOpen = useProjectPickerOpen();
  // Both panes are there to be read against something else the window is
  // showing, and in the native shell there is always something — the browser
  // pane is a window of its own, and an analysis is opened from either mode. A
  // browser tab has no <webview> to put behind the second, and only reads an
  // analysis beside the code. A pane the window cannot show is off the menu,
  // and its chord does nothing.
  const paneAvailable = (pane: BarPane): boolean =>
    pane === "browser" ? isDesktop : isDesktop || inCodeMode;
  const windowMenu =
    inCodeMode || paneAvailable("analysis") || paneAvailable("browser");
  const togglePane = (pane: BarPane) => {
    if (!paneAvailable(pane)) return;
    toggleSidePane(pane);
  };
  // The bar's own chords: the project chip's, and the side panes'. The strip's
  // — a session, the launchpad, a tab — are answered by the strip itself.
  useEffect(() => {
    const run = (shortcut: BarShortcut) => {
      switch (shortcut.kind) {
        case "project-picker":
          return setProjectPickerOpen(true);
        case "pane":
          return togglePane(shortcut.pane);
        default:
          return undefined;
      }
    };
    const onKey = (event: KeyboardEvent) => {
      const shortcut = barShortcut(event);
      if (shortcut === null || !BAR_SHORTCUTS.has(shortcut.kind)) return;
      event.preventDefault();
      run(shortcut);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
            `trafficLightPosition` in the desktop main process). A browser tab
            has no controls there, so the bar starts at its edge. */}
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
            being one more thing on the page under them. Switching project keeps
            a session or a board where it is; on the code surfaces it lands in
            the arriving project's tree, as it always has. */}
        <div className={cn("flex min-w-0 shrink-0", NO_DRAG)}>
          <ProjectPicker
            workspace={workspace.data}
            open={pickerOpen}
            onOpenChange={setProjectPickerOpen}
            onChosen={inCodeMode ? undefined : stayPut}
            onWindowBar
            tooltip={<BarLabel label="Projects" keys={PROJECT_PICKER_KEYS} />}
          />
        </div>

        <WindowTabStrip />
      </div>
      {/* The trailing end keeps its content whatever the window's width: it is
          the strip that gives way first. Its inset is a gutter like the lead
          one rather than padding, so both ends of the bar read the same. */}
      <div className="flex shrink-0 items-center justify-end gap-1">
        {/* The launchpad is where the window keeps its tabs, and it is reached
            often enough to be worth a press rather than two — the menu beside
            it holds the surfaces that are opened once and left. */}
        <BarButton
          label="Launchpad"
          keys={LAUNCHPAD_KEYS}
          pressed={overviewOpen}
          onClick={toggleTabOverview}
        >
          <IconLayoutGrid className="size-4" />
        </BarButton>
        {/* Everything the window can put beside the page, under one handle:
            each row names itself, and hovering it says which chord does the
            same. Off the modes that have any, the handle itself goes. */}
        {windowMenu && (
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

            {/* Narrower than a menu's default: these rows are short names, and
                the chords that would have set the width are in the tooltips
                rather than along them. */}
            <DropdownMenuContent align="end" className="min-w-48">
              {/* The palette is code mode's, and so is the host that answers
                  ⌘K: off it there is nothing behind the row to open. */}
              {inCodeMode && (
                <MenuRow
                  label="Command menu"
                  keys={COMMANDS_KEYS}
                  onClick={() => openSearch("commands")}
                >
                  <IconCommand className="size-4 shrink-0" />
                </MenuRow>
              )}
              {paneAvailable("analysis") && (
                <MenuRow
                  label="Analysis"
                  keys={ANALYSIS_KEYS}
                  onClick={() => togglePane("analysis")}
                >
                  <IconSitemap className="size-4 shrink-0" />
                </MenuRow>
              )}
              {paneAvailable("browser") && (
                <MenuRow
                  label="Browser"
                  keys={BROWSER_KEYS}
                  onClick={() => togglePane("browser")}
                >
                  <IconWorld className="size-4 shrink-0" />
                </MenuRow>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div aria-hidden className="w-2 shrink-0" />
      </div>
    </header>
  );
}
