/**
 * WindowBar — the strip along the top of the native window: the macOS traffic
 * lights, history navigation, and the tab strip.
 *
 * Native-shell only. In a browser tab all three already exist one level up —
 * the browser's own tabs, its back button, its chrome — so WindowFrame does not
 * render this there. Empty regions drag the window; every control opts back out.
 */
import {
  IconArrowLeft,
  IconArrowRight,
  IconPlus,
  IconX,
} from "@tabler/icons-react";
import {
  useCanGoBack,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  nextTabId,
  updateWindowTabs,
  useWindowTabs,
  windowTabsSnapshot,
} from "@/interactions/window-tabs/adapters/window-tabs.store";
import {
  closeTab,
  HOME_HREF,
  moveTab,
  openTab,
  selectTab,
  tabAtPosition,
  tabTitle,
  trackLocation,
} from "@/interactions/window-tabs/functions/window-tabs.functions";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { cn } from "@/lib/utils";

const NO_DRAG = "[-webkit-app-region:no-drag]";

function BarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            className={cn("rounded-lg text-muted-foreground", NO_DRAG)}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export function WindowBar() {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const location = useRouterState({ select: (s) => s.location });
  const { tabs, activeId } = useWindowTabs();
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

  const go = (href: string) => void router.navigate({ href });

  // The active tab is wherever the window currently is, however it got there.
  useEffect(() => {
    updateWindowTabs((state) =>
      trackLocation(state, location.href, tabTitle(location.pathname))
    );
  }, [location.href, location.pathname]);

  const open = (href: string) => {
    updateWindowTabs((state) =>
      openTab(state, { id: nextTabId(), href, title: tabTitle(href) })
    );
    go(href);
  };

  const close = (id: string) => {
    updateWindowTabs((state) => {
      const next = closeTab(state, id);
      if (next.activeId !== state.activeId) {
        const landing = next.tabs.find((tab) => tab.id === next.activeId);
        if (landing !== undefined) go(landing.href);
      }
      return next;
    });
  };

  // ⌘1–⌘8 jump to that tab and ⌘9 to the last one, as in every browser. The
  // strip is read from the store rather than this render's copy: two presses in
  // a row arrive before React has re-rendered for the first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const position = Number(event.key);
      if (!Number.isInteger(position) || position < 1 || position > 9) return;
      event.preventDefault();
      const target = tabAtPosition(windowTabsSnapshot().tabs, position);
      if (target === null) return;
      updateWindowTabs((state) => selectTab(state, target.id));
      go(target.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <header
      className={cn(
        // The traffic lights are drawn by macOS over the bar's top-left; the
        // lead padding is what the window's own controls sit in, so it has to
        // clear them (see `trafficLightPosition` in the desktop main process).
        "flex h-11 shrink-0 items-center gap-1 pr-2 pl-24",
        "[-webkit-app-region:drag]"
      )}
    >
      <SidebarToggle className={NO_DRAG} />
      <BarButton
        label="Back"
        disabled={!canGoBack}
        onClick={() => router.history.back()}
      >
        <IconArrowLeft className="size-5" />
      </BarButton>
      <BarButton label="Forward" onClick={() => router.history.forward()}>
        <IconArrowRight className="size-5" />
      </BarButton>

      <div
        role="tablist"
        aria-label="Open tabs"
        className={cn(
          "ml-1 flex min-w-0 items-center gap-1 overflow-x-auto",
          NO_DRAG
        )}
      >
        {tabs.map((tab, index) => {
          const active = tab.id === activeId;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              title={tab.title}
              draggable
              className={cn(
                "group/tab flex h-8 max-w-52 min-w-0 shrink-0 cursor-default items-center gap-1.5 rounded-lg pr-1.5 pl-3 text-[0.8125rem] transition-colors",
                active
                  ? "bg-elevate-strong text-foreground"
                  : "text-muted-foreground hover:bg-elevate",
                dragging === tab.id && "opacity-50"
              )}
              onDragStart={(event) => {
                draggingRef.current = tab.id;
                setDragging(tab.id);
                event.dataTransfer.effectAllowed = "move";
                // Firefox refuses to start a drag without a payload.
                event.dataTransfer.setData("text/plain", tab.id);
              }}
              onDragOver={(event) => {
                const held = draggingRef.current;
                if (held === null) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                // Reorder as the pointer crosses each tab, so the strip shows
                // where the drop will land instead of only revealing it after.
                if (held !== tab.id) {
                  updateWindowTabs((state) => moveTab(state, held, index));
                }
              }}
              onDragEnd={endDrag}
              onDrop={(event) => {
                event.preventDefault();
                endDrag();
              }}
              onClick={() => {
                updateWindowTabs((state) => selectTab(state, tab.id));
                if (!active) go(tab.href);
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  close(tab.id);
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  go(tab.href);
                }
              }}
            >
              <span className="truncate">{tab.title}</span>
              <button
                type="button"
                aria-label={`Close ${tab.title}`}
                className={cn(
                  "shrink-0 rounded p-0.5 hover:bg-elevate-strong",
                  active
                    ? "opacity-70"
                    : "opacity-0 group-hover/tab:opacity-70",
                  tabs.length === 1 && "invisible"
                )}
                onClick={(event) => {
                  event.stopPropagation();
                  close(tab.id);
                }}
              >
                <IconX className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <BarButton label="New tab" onClick={() => open(HOME_HREF)}>
        <IconPlus className="size-5" />
      </BarButton>
      <div className="flex-1" />
    </header>
  );
}
