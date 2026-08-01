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
} from "@tabler/icons-react"
import { useCanGoBack, useRouter, useRouterState } from "@tanstack/react-router"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  nextTabId,
  updateWindowTabs,
  useWindowTabs,
} from "@/interactions/window-tabs/adapters/window-tabs.store"
import {
  closeTab,
  HOME_HREF,
  neighbourTab,
  openTab,
  selectTab,
  tabTitle,
  trackLocation,
} from "@/interactions/window-tabs/functions/window-tabs.functions"
import { SidebarToggle } from "@/components/layout/sidebar-toggle"
import { cn } from "@/lib/utils"

const NO_DRAG = "[-webkit-app-region:no-drag]"

function BarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
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
  )
}

export function WindowBar() {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const location = useRouterState({ select: (s) => s.location })
  const { tabs, activeId } = useWindowTabs()

  const go = (href: string) => void router.navigate({ href })

  // The active tab is wherever the window currently is, however it got there.
  useEffect(() => {
    updateWindowTabs((state) =>
      trackLocation(state, location.href, tabTitle(location.pathname))
    )
  }, [location.href, location.pathname])

  const open = (href: string) => {
    updateWindowTabs((state) =>
      openTab(state, { id: nextTabId(), href, title: tabTitle(href) })
    )
    go(href)
  }

  const close = (id: string) => {
    updateWindowTabs((state) => {
      const next = closeTab(state, id)
      if (next.activeId !== state.activeId) {
        const landing = next.tabs.find((tab) => tab.id === next.activeId)
        if (landing !== undefined) go(landing.href)
      }
      return next
    })
  }

  // Cmd/Ctrl+T opens a tab, Cmd/Ctrl+W closes one, and Ctrl+Tab steps along the
  // strip — the shortcuts every tabbed window already answers to.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault()
        updateWindowTabs((state) => {
          const next = neighbourTab(state, event.shiftKey ? -1 : 1)
          if (next === null) return state
          go(next.href)
          return selectTab(state, next.id)
        })
        return
      }
      if (!(event.metaKey || event.ctrlKey)) return
      const key = event.key.toLowerCase()
      if (key === "t") {
        event.preventDefault()
        open(HOME_HREF)
      } else if (key === "w") {
        event.preventDefault()
        close(activeId)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

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
        <IconArrowLeft className="size-4.5" />
      </BarButton>
      <BarButton label="Forward" onClick={() => router.history.forward()}>
        <IconArrowRight className="size-4.5" />
      </BarButton>

      <div
        role="tablist"
        aria-label="Open tabs"
        className={cn(
          "ml-1 flex min-w-0 items-center gap-1 overflow-x-auto",
          NO_DRAG
        )}
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              title={tab.title}
              className={cn(
                "group/tab flex h-8 max-w-52 min-w-0 shrink-0 cursor-default items-center gap-1.5 rounded-lg pr-1.5 pl-3 text-[0.8125rem] transition-colors",
                active
                  ? "bg-elevate-strong text-foreground"
                  : "text-muted-foreground hover:bg-elevate"
              )}
              onClick={() => {
                updateWindowTabs((state) => selectTab(state, tab.id))
                if (!active) go(tab.href)
              }}
              onAuxClick={(event) => {
                if (event.button === 1) {
                  event.preventDefault()
                  close(tab.id)
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  go(tab.href)
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
                  event.stopPropagation()
                  close(tab.id)
                }}
              >
                <IconX className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
      <BarButton label="New tab" onClick={() => open(HOME_HREF)}>
        <IconPlus className="size-4.5" />
      </BarButton>
      <div className="flex-1" />
    </header>
  )
}
