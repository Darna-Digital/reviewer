/**
 * The open-file strip over the centre pane.
 *
 * Reads as an IDE's: the file name, italic while the tab is only a preview, a
 * pin marker when it is pinned, a dot when the buffer is unsaved, and a close
 * control that appears on the active tab or on hover. Middle-click closes, as
 * it does in every editor and browser.
 *
 * The strip scrolls rather than shrinking its tabs to nothing, and pinned tabs
 * sort to the head so they stay reachable once it does. Tabs drag into any
 * order, shift-click closes one without aiming for its ✕, and a double click
 * past the last tab opens an empty one.
 *
 * A tab shows only the file's name; its path is a tooltip, and everything that
 * acts on the file — edit it, read its history — is on its context menu.
 */
import {
  IconHistory,
  IconPencil,
  IconPin,
  IconPinnedFilled,
  IconX,
} from "@tabler/icons-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isImagePath } from "@/components/editor/image-view";
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
  /** A double click settles a preview tab, as in every IDE. */
  readonly onKeep: (path: string) => void;
  readonly onClose: (path: string) => void;
  readonly onTogglePin: (path: string) => void;
  readonly onCloseOthers: (path: string) => void;
  readonly onCloseAll: () => void;
  /** Drop the dragged tab at `toIndex` of the strip's order. */
  readonly onMove: (path: string, toIndex: number) => void;
  /** A double click past the last tab, as in a browser's strip. */
  readonly onOpenBlank: () => void;
  /** Open this file for editing. Omit to leave the strip read-only. */
  readonly onEditFile?: (path: string) => void;
  /** Show this file's commit history. */
  readonly onShowHistory?: (path: string) => void;
  /** The open file's own controls — Save, Done, its problem count — pinned to
   * the end of the strip, so the file and everything acting on it share a line. */
  readonly actions?: ReactNode;
}

export function TabStrip({
  tabs,
  active,
  dirty,
  onSelect,
  onKeep,
  onClose,
  onTogglePin,
  onCloseOthers,
  onCloseAll,
  onMove,
  onOpenBlank,
  onEditFile,
  onShowHistory,
  actions,
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
        className="flex shrink-0 items-stretch overflow-x-auto border-b border-border bg-background"
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
                className={cn(
                  "group/tab flex max-w-56 min-w-0 shrink-0 cursor-default items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs",
                  isActive
                    ? "bg-elevate text-foreground"
                    : "text-muted-foreground hover:bg-elevate/60",
                  dragging === tab.path && "opacity-50"
                )}
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
                {tab.pinned && (
                  <IconPinnedFilled
                    className="size-3 shrink-0 text-muted-foreground"
                    aria-label="Pinned"
                  />
                )}
                <span
                  className={cn("truncate", tab.preview && "italic")}
                  // A preview tab is one the next single click may replace; the
                  // italic says so without needing a legend.
                >
                  {pathName(tab.path)}
                </span>
                {dirty.has(tab.path) ? (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-primary"
                    aria-label="Unsaved changes"
                  />
                ) : (
                  <button
                    type="button"
                    aria-label={`Close ${pathName(tab.path)}`}
                    className={cn(
                      "shrink-0 rounded p-0.5 hover:bg-elevate",
                      isActive
                        ? "opacity-70"
                        : "opacity-0 group-hover/tab:opacity-70"
                    )}
                    onClick={(event) => {
                      event.stopPropagation();
                      onClose(tab.path);
                    }}
                  >
                    <IconX className="size-3" />
                  </button>
                )}
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="start"
                // A path has no spaces to break at, so it would otherwise run
                // straight out of the popup instead of wrapping inside it.
                className="max-w-[min(32rem,var(--available-width,32rem))] font-mono break-all whitespace-normal"
              >
                {tab.path}
              </TooltipContent>
            </Tooltip>
          );
        })}
        <div
          aria-hidden
          className="min-w-8 flex-1 cursor-default"
          onDoubleClick={onOpenBlank}
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
        {actions !== undefined && (
          // Sticky, so a strip scrolled sideways keeps the open file's controls
          // where they were rather than sliding them off the end.
          <div className="sticky right-0 flex shrink-0 items-center gap-1 border-l border-border bg-background px-2">
            {actions}
          </div>
        )}
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
            {onEditFile !== undefined && !isImagePath(menu.path) && (
              <DropdownMenuItem
                onClick={() => {
                  onEditFile(menu.path);
                  setMenu(null);
                }}
              >
                <IconPencil /> Edit file
              </DropdownMenuItem>
            )}
            {onShowHistory !== undefined && (
              <DropdownMenuItem
                onClick={() => {
                  onShowHistory(menu.path);
                  setMenu(null);
                }}
              >
                <IconHistory /> File history
              </DropdownMenuItem>
            )}
            {(onEditFile !== undefined || onShowHistory !== undefined) && (
              <DropdownMenuSeparator />
            )}
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
