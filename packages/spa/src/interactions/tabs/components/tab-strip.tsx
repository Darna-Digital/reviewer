/**
 * The open-file strip over the centre pane.
 *
 * Reads as an IDE's: the file name, italic while the tab is only a preview, a
 * pin marker when it is pinned, a dot when the buffer is unsaved, and a close
 * control that appears on the active tab or on hover. Middle-click closes, as
 * it does in every editor and browser.
 *
 * The strip scrolls rather than shrinking its tabs to nothing, and pinned tabs
 * sort to the head so they stay reachable once it does.
 */
import { IconPin, IconPinnedFilled, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
}: TabStripProps) {
  const ordered = orderTabs(tabs);
  const stripRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

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
        {ordered.map((tab) => {
          const isActive = tab.path === active;
          return (
            <div
              key={tab.path}
              data-tab={tab.path}
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              title={tab.path}
              className={cn(
                "group/tab flex max-w-56 min-w-0 shrink-0 cursor-default items-center gap-1.5 border-r border-border px-3 py-1.5 text-xs",
                isActive
                  ? "bg-elevate text-foreground"
                  : "text-muted-foreground hover:bg-elevate/60"
              )}
              onClick={() => onSelect(tab.path)}
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
            </div>
          );
        })}
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
