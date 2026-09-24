/**
 * The open-file strip, in the header band over the centre pane.
 *
 * Reads as an IDE's: the file's type icon — the tree's own — then its name,
 * italic while the tab is only a preview, a pin marker when it is pinned, and a
 * close control that appears on the active tab or on hover — replaced by a dot
 * while the buffer is unsaved, which the same hover trades back for the ✕.
 * Middle-click closes, as it does in every editor and browser.
 *
 * The strip scrolls rather than shrinking its tabs to nothing, and pinned tabs
 * sort to the head so they stay reachable once it does. Tabs drag into any
 * order, shift-click closes one without aiming for its ✕, and a double click
 * past the last tab opens an empty one.
 *
 * A tab shows only the file's name; its path is a tooltip, and what acts on the
 * file — read its history, pin it, close it — is a right-click away on the tab
 * itself, which is the one thing on screen naming that file inside the macOS
 * shell, where the trail along the foot of the pane is the window's own.
 *
 * It draws no band of its own: the header lends it one (see `header-tabs`), and
 * a strip with its own background and rule inside that band would be a second
 * header drawn on top of the first.
 */
import { IconHistory, IconPin, IconPinnedFilled } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import {
  TAB_STRIP,
  TabClose,
  tabChipClass,
} from "@/components/layout/tab-chip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  pointerAnchor,
  type VirtualAnchor,
} from "@/interactions/language/functions/anchors";
import { pathName } from "@/lib/display-path";
import { cn } from "@/lib/utils";
import { orderTabs } from "../functions/tabs.functions";
import type { Tab } from "../interfaces/tabs.interfaces";

/** The tab a right-click opened the menu on, and where to hang it. */
interface MenuState {
  readonly path: string;
  readonly anchor: VirtualAnchor;
}

export interface TabStripProps {
  readonly tabs: ReadonlyArray<Tab>;
  readonly active: string | null;
  /** Paths whose buffer has unsaved changes. */
  readonly dirty: ReadonlySet<string>;
  readonly onSelect: (path: string) => void;
  /** The pointer has reached a tab: the moment to render its file ahead. */
  readonly onIntent?: (path: string) => void;
  /** A double click settles a preview tab, as in every IDE. */
  readonly onKeep: (path: string) => void;
  readonly onClose: (path: string) => void;
  readonly onTogglePin: (path: string) => void;
  readonly onCloseOthers: (path: string) => void;
  readonly onCloseAll: () => void;
  /** Read this file's past. Absent where there is no history to read. */
  readonly onShowHistory?: (path: string) => void;
  /** Drop the dragged tab at `toIndex` of the strip's order. */
  readonly onMove: (path: string, toIndex: number) => void;
}

export function TabStrip({
  tabs,
  active,
  dirty,
  onSelect,
  onIntent,
  onKeep,
  onClose,
  onTogglePin,
  onCloseOthers,
  onCloseAll,
  onShowHistory,
  onMove,
}: TabStripProps) {
  const ordered = orderTabs(tabs);
  const stripRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  /**
   * The tab being dragged. It lives in a ref as well as state because the first
   * `dragover` can arrive in the same task as the `dragstart` that set it, and
   * would read the pre-render value; the state copy only drives the styling.
   */
  const draggingRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const endDrag = () => {
    draggingRef.current = null;
    setDragging(null);
  };

  // Selecting a tab from outside the strip — go-to-definition, the command
  // menu — can select one that is scrolled out of the strip.
  useEffect(() => {
    if (active === null) return;
    stripRef.current
      ?.querySelector(`[data-tab="${CSS.escape(active)}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  if (ordered.length === 0) return null;

  return (
    <>
      <div
        ref={stripRef}
        role="tablist"
        aria-label="Open files"
        className={cn(TAB_STRIP, "min-w-0 flex-1")}
      >
        {ordered.map((tab, index) => {
          const isActive = tab.path === active;
          return (
            <Tooltip
              key={tab.path}
              // The path is an answer to hovering a tab, not to acting on one:
              // a drag or the context menu has the pointer for something else.
              disabled={menu !== null || dragging !== null}
            >
              <TooltipTrigger
                data-tab={tab.path}
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                draggable
                className={tabChipClass(isActive, dragging === tab.path)}
                render={<div />}
                onDragStart={(event) => {
                  draggingRef.current = tab.path;
                  setDragging(tab.path);
                  event.dataTransfer.effectAllowed = "move";
                  // Firefox refuses to start a drag without a payload.
                  event.dataTransfer.setData("text/plain", tab.path);
                }}
                onDragOver={(event) => {
                  const held = draggingRef.current;
                  if (held === null) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                  // Reorder as the pointer crosses each tab, so the strip shows
                  // where the drop will land instead of only revealing it after.
                  if (held !== tab.path) onMove(held, index);
                }}
                onDragEnd={endDrag}
                onDrop={(event) => {
                  event.preventDefault();
                  endDrag();
                }}
                onPointerEnter={() => onIntent?.(tab.path)}
                onClick={(event) => {
                  // Shift-click closes, so a tab can go without aiming for its ✕.
                  if (event.shiftKey) {
                    event.preventDefault();
                    onClose(tab.path);
                    return;
                  }
                  onSelect(tab.path);
                }}
                onDoubleClick={() => onKeep(tab.path)}
                onAuxClick={(event) => {
                  // Middle click closes, as everywhere else with tabs.
                  if (event.button === 1) {
                    event.preventDefault();
                    onClose(tab.path);
                  }
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setMenu({
                    path: tab.path,
                    anchor: pointerAnchor(event.clientX, event.clientY),
                  });
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(tab.path);
                  }
                }}
              >
                {tab.pinned ? (
                  <IconPinnedFilled
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-label="Pinned"
                  />
                ) : (
                  <FileTypeIcon path={tab.path} />
                )}
                <span
                  // The italic's slant overhangs its glyph box, so the last
                  // letter needs a pixel of its own not to be clipped away.
                  className={cn("truncate", tab.preview && "pr-px italic")}
                  // A preview tab is one the next single click may replace; the
                  // italic says so without needing a legend.
                >
                  {pathName(tab.path)}
                </span>
                <TabClose
                  label={`Close ${pathName(tab.path)}`}
                  active={isActive}
                  dirty={dirty.has(tab.path)}
                  onClose={() => onClose(tab.path)}
                />
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                className="max-w-none whitespace-nowrap"
              >
                {tab.path}
              </TooltipContent>
            </Tooltip>
          );
        })}
        <div
          aria-hidden
          className="min-w-8 flex-1 cursor-default"
          onDragOver={(event) => {
            if (draggingRef.current === null) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            onMove(draggingRef.current, ordered.length - 1);
          }}
          onDrop={(event) => {
            event.preventDefault();
            endDrag();
          }}
        />
      </div>
      {menu !== null && (
        <DropdownMenu
          open
          onOpenChange={(open) => {
            if (!open) setMenu(null);
          }}
        >
          <DropdownMenuContent
            anchor={menu.anchor}
            side="bottom"
            align="start"
            className="min-w-52"
          >
            <DropdownMenuItem
              onClick={() => {
                onTogglePin(menu.path);
                setMenu(null);
              }}
            >
              {tabs.find((tab) => tab.path === menu.path)?.pinned === true ? (
                <>
                  <IconPin /> Unpin tab
                </>
              ) : (
                <>
                  <IconPinnedFilled /> Pin tab
                </>
              )}
            </DropdownMenuItem>
            {onShowHistory !== undefined && (
              <DropdownMenuItem
                onClick={() => {
                  onShowHistory(menu.path);
                  setMenu(null);
                }}
              >
                <IconHistory /> History
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                onClose(menu.path);
                setMenu(null);
              }}
            >
              Close
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                onCloseOthers(menu.path);
                setMenu(null);
              }}
            >
              Close others
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                onCloseAll();
                setMenu(null);
              }}
            >
              Close all
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  );
}
