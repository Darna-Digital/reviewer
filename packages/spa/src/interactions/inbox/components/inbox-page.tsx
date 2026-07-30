/**
 * InboxPage — a three-pane inbox: the current mode's sidebar, the item list,
 * and the selected thread. Both modes link here, so the sidebar it renders
 * follows the mode you came from.
 */
import { IconChevronDown, IconDots, IconUsers } from "@tabler/icons-react"
import { useRouterState } from "@tanstack/react-router"
import { useState } from "react"
import { NavSidebar } from "@/components/layout/sidebar-nav"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CollaborationSidebar } from "@/interactions/collaboration/components/collaboration-sidebar"
import { MessageComposer } from "@/interactions/collaboration/components/message-composer"
import {
  INBOX_ITEMS,
  UNREAD_COUNT,
  type InboxFilter,
} from "@/interactions/inbox/data/inbox.mock"
import { useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"
import { activeWorkMode } from "@/lib/work-mode"

const FILTERS: ReadonlyArray<{ value: InboxFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "mentions", label: "Mentions" },
]

export function InboxPage() {
  const { workMode } = useUiPrefs()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [filter, setFilter] = useState<InboxFilter>("all")
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedId, setSelectedId] = useState(INBOX_ITEMS[0]?.id ?? "")

  const items = INBOX_ITEMS.filter((i) =>
    filter === "unread" ? i.unread : filter === "mentions" ? i.mention : true
  )
  const selected =
    INBOX_ITEMS.find((i) => i.id === selectedId) ?? items[0] ?? INBOX_ITEMS[0]
  const filterLabel =
    FILTERS.find((f) => f.value === filter)?.label ?? FILTERS[0]?.label

  return (
    <div className="flex h-full min-h-0">
      {activeWorkMode(pathname, workMode) === "collaboration" ? (
        <CollaborationSidebar />
      ) : (
        <NavSidebar />
      )}

      <div className="flex w-80 shrink-0 flex-col border-r">
        <header className="flex h-11 shrink-0 items-center justify-between border-b px-2">
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger
              render={
                <Button variant="ghost" size="sm" className="gap-1.5 px-2" />
              }
            >
              {filterLabel}
              <IconChevronDown className="size-3.5 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-40 gap-0 p-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  className={cn(
                    "flex h-8 w-full items-center rounded-lg px-2 text-left text-[13px] text-muted-foreground outline-none hover:bg-elevate hover:text-foreground",
                    f.value === filter && "bg-muted text-foreground"
                  )}
                  onClick={() => {
                    setFilter(f.value)
                    setFilterOpen(false)
                  }}
                >
                  {f.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground">
            {UNREAD_COUNT} unread
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label="Inbox options"
          >
            <IconDots className="size-4" />
          </Button>
        </header>

        <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={cn(
                "flex w-full gap-2.5 border-b px-3 py-2.5 text-left outline-none hover:bg-elevate",
                item.id === selected?.id && "bg-muted"
              )}
            >
              <Avatar name={item.author} className="size-7" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-[13px] font-medium">
                    {item.author}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {item.time}
                  </span>
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  {item.reason}
                  <span className="rounded bg-elevate px-1 py-px text-foreground">
                    #{item.channel}
                  </span>
                </span>
                <span className="mt-1 line-clamp-2 block text-[13px] text-muted-foreground">
                  {item.preview}
                </span>
              </span>
              {item.unread && (
                <span className="mt-2 size-2 shrink-0 rounded-full bg-sky-500" />
              )}
            </button>
          ))}
          {items.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nothing here.
            </div>
          )}
        </ScrollArea>
      </div>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-11 shrink-0 items-center gap-2 border-b px-4">
          <span className="text-sm font-medium">
            Thread in #{selected?.channel}
          </span>
          <div className="ml-auto flex items-center gap-1 text-muted-foreground">
            <IconUsers className="size-4" />
            <span className="text-xs tabular-nums">
              {selected?.thread.length ?? 0}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Thread options"
            >
              <IconDots className="size-4" />
            </Button>
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-4">
            {selected?.thread.map((m) => (
              <div key={m.id} className="flex gap-3">
                <Avatar name={m.author} className="mt-0.5 size-7" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium">{m.author}</span>
                    {m.managed !== undefined && (
                      <Badge variant="outline" className="h-4.5 px-1.5">
                        {m.managed}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {m.time}
                    </span>
                  </div>
                  {m.body.map((paragraph, index) => (
                    <p
                      key={index}
                      className="mt-1 max-w-[70ch] text-sm text-pretty"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <MessageComposer
          placeholder={`Send reply to #${selected?.channel} thread`}
        />
      </section>
    </div>
  )
}
