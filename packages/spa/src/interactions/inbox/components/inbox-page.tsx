/**
 * InboxPage — the item list beside the selected thread, filling the window.
 * Collaboration mode's prototype inbox, on mock data: a destination of its own
 * rather than a pane inside the workspace you came from. Code mode's inbox is
 * the real thing, over the repo's agent threads.
 */
import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconChevronDown,
  IconDots,
  IconSend,
  IconUsers,
} from "@tabler/icons-react";
import { Link, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ResizeHandle } from "@/components/layout/resize-handle";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AgentHoverCard } from "@/interactions/collaboration/components/agent-hover-card";
import { AgentMark } from "@/interactions/threads/components/agent-mark";
import {
  findAgentById,
  managedBy,
} from "@/interactions/collaboration/data/collaboration.mock";
import { NewChatView } from "@/interactions/collaboration/components/new-chat-view";
import { MessageComposer } from "@/interactions/collaboration/components/message-composer";
import { PaneHeader } from "@/components/layout/pane-header";
import {
  INBOX_ITEMS,
  type InboxFilter,
} from "@/interactions/inbox/data/inbox.mock";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

const FILTERS: ReadonlyArray<{ value: InboxFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "mentions", label: "Mentions" },
];

/** An agent author's mark, carrying the hover card that names whose it is. */
function AgentAuthorMark({ agentId }: { agentId: string }) {
  const agent = findAgentById(agentId);
  if (agent === undefined) return null;
  return (
    <AgentHoverCard agent={agent}>
      <AgentMark kind={agent.kind} className="mt-0.5 size-7 rounded-lg" />
    </AgentHoverCard>
  );
}

export function InboxPage() {
  const prefs = useUiPrefs();
  const composing = useSearch({ strict: false }).compose === "chat";
  const [listWidth, setListWidth] = useState(prefs.inboxListWidth);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(INBOX_ITEMS[0]?.id ?? "");
  const [expanded, setExpanded] = useState(false);

  const items = INBOX_ITEMS.filter((i) =>
    filter === "unread" ? i.unread : filter === "mentions" ? i.mention : true
  );
  const selected =
    INBOX_ITEMS.find((i) => i.id === selectedId) ?? items[0] ?? INBOX_ITEMS[0];
  const filterLabel =
    FILTERS.find((f) => f.value === filter)?.label ?? FILTERS[0]?.label;

  const showList = !composing && !expanded && prefs.sidebarVisible;

  return (
    <div className="flex h-full min-h-0">
      {showList && (
        <div
          className="flex shrink-0 flex-col border-r"
          style={{ width: listWidth }}
        >
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
                      setFilter(f.value);
                      setFilterOpen(false);
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <Button
              variant="ghost"
              size="icon"
              aria-label="New chat"
              className={cn("size-7", composing && "bg-muted text-foreground")}
              render={
                <Link
                  to="/modes/collaboration/inbox"
                  search={{ compose: "chat" }}
                />
              }
            >
              <IconSend className="size-4" />
            </Button>
          </header>

          <ScrollArea
            className="min-h-0 flex-1"
            viewportClassName="scroll-fade"
          >
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
                {item.agentId === undefined ? (
                  <Avatar name={item.author} className="size-7" />
                ) : (
                  <AgentAuthorMark agentId={item.agentId} />
                )}
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
      )}
      {showList && (
        <ResizeHandle
          orientation="col"
          value={listWidth}
          min={240}
          max={() => Math.max(320, window.innerWidth - 480)}
          onResize={setListWidth}
          onResizeEnd={(w) => setUiPrefs({ inboxListWidth: w })}
          label="Resize the message list"
        />
      )}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {composing ? (
          <NewChatView />
        ) : (
          <>
            <PaneHeader
              crumbs={
                expanded
                  ? [
                      <button
                        key="inbox"
                        type="button"
                        onClick={() => setExpanded(false)}
                        className="shrink-0 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
                      >
                        Inbox
                      </button>,
                      <span
                        key="channel"
                        className="truncate text-muted-foreground"
                      >
                        #{selected?.channel}
                      </span>,
                      <span key="thread" className="truncate font-medium">
                        Thread
                      </span>,
                    ]
                  : [
                      <span key="thread" className="truncate font-medium">
                        Thread in #{selected?.channel}
                      </span>,
                    ]
              }
              actions={
                <div className="flex items-center gap-1 text-muted-foreground">
                  <IconUsers className="size-4" />
                  <span className="text-xs tabular-nums">
                    {selected?.thread.length ?? 0}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={expanded ? "Exit full width" : "Expand full"}
                    onClick={() => setExpanded(!expanded)}
                  >
                    {expanded ? (
                      <IconArrowsDiagonalMinimize2 className="size-4" />
                    ) : (
                      <IconArrowsDiagonal className="size-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label="Thread options"
                  >
                    <IconDots className="size-4" />
                  </Button>
                </div>
              }
            />

            <ScrollArea
              className="min-h-0 flex-1"
              viewportClassName="scroll-fade"
            >
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-4">
                {selected?.thread.map((m) => (
                  <div key={m.id} className="flex gap-3">
                    {m.agentId === undefined ? (
                      <Avatar name={m.author} className="mt-0.5 size-7" />
                    ) : (
                      <AgentAuthorMark agentId={m.agentId} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[0.8125rem] font-medium">
                          {m.author}
                        </span>
                        {m.agentId !== undefined && (
                          <Badge variant="outline" className="h-4.5 px-1.5">
                            {managedBy(m.agentId)}
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
          </>
        )}
      </section>
    </div>
  );
}
