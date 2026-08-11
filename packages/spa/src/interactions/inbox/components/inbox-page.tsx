/**
 * InboxPage — what your teammates need from you, beside the task each ping came
 * from. Collaboration mode's prototype inbox, on mock data.
 *
 * A row is a person doing something to a task; opening it shows that task and
 * the comments on it, so answering the ping and answering the task are the same
 * act. The mode's sidebar stays alongside — the inbox is reached from a row in
 * it, so it is also the way back out.
 */
import {
  IconArrowsDiagonal,
  IconArrowsDiagonalMinimize2,
  IconChevronDown,
  IconDots,
  IconMessageCircle,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { SidebarResizeHandle } from "@/components/layout/sidebar-resize-handle";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AssigneeAvatar } from "@/interactions/collaboration/components/assignee-avatar";
import { CollaborationSidebar } from "@/interactions/collaboration/components/collaboration-sidebar";
import { CollaborationTabs } from "@/interactions/collaboration-tabs/components/collaboration-tabs";
import { MessageComposer } from "@/interactions/collaboration/components/message-composer";
import { ScopeGlyph } from "@/interactions/collaboration/components/scope-glyph";
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon";
import {
  findProject,
  findScope,
} from "@/interactions/collaboration/data/collaboration.mock";
import { PaneHeader } from "@/components/layout/pane-header";
import {
  INBOX_ITEMS,
  inboxComments,
  inboxTask,
  REASON_LABEL,
  type InboxFilter,
} from "@/interactions/inbox/data/inbox.mock";
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs";
import { cn } from "@/lib/utils";

const FILTERS: ReadonlyArray<{ value: InboxFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "mentions", label: "Mentions" },
];

export function InboxPage() {
  const prefs = useUiPrefs();
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

  const task = selected === undefined ? undefined : inboxTask(selected);
  const comments = selected === undefined ? [] : inboxComments(selected);
  const project = task === undefined ? undefined : findProject(task.projectId);
  const scope = task === undefined ? undefined : findScope(task.scopeId);

  const showList = !expanded && prefs.sidebarVisible;

  return (
    <div className="flex h-full min-h-0">
      {prefs.sidebarVisible && <CollaborationSidebar />}
      {showList && (
        <div
          className="flex shrink-0 flex-col border-r"
          style={{ width: listWidth }}
        >
          <header className="flex h-9 shrink-0 items-center justify-between border-b px-2">
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
          </header>

          <ScrollArea
            className="min-h-0 flex-1"
            viewportClassName="scroll-fade"
          >
            {items.map((item) => {
              const on = inboxTask(item);
              return (
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
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                        {item.time}
                      </span>
                    </span>
                    <span className="flex min-w-0 items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
                      <span className="shrink-0">
                        {REASON_LABEL[item.reason]}
                      </span>
                      <span className="shrink-0 rounded bg-elevate px-1 py-px font-mono text-foreground">
                        {on?.key}
                      </span>
                      <span className="truncate">{on?.title}</span>
                    </span>
                    <span className="mt-1 line-clamp-2 block text-[13px] text-muted-foreground">
                      {item.preview}
                    </span>
                  </span>
                  {item.unread && (
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-brand-500" />
                  )}
                </button>
              );
            })}
            {items.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nothing here.
              </div>
            )}
          </ScrollArea>
        </div>
      )}
      {showList && (
        <SidebarResizeHandle
          width={listWidth}
          stored={prefs.inboxListWidth}
          max={() => Math.max(320, window.innerWidth - 480)}
          onResize={setListWidth}
          onResizeEnd={(w) => setUiPrefs({ inboxListWidth: w })}
          label="Resize the message list"
        />
      )}

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <CollaborationTabs />
        <PaneHeader
          foot
          crumbs={[
            ...(expanded
              ? [
                  <button
                    key="inbox"
                    type="button"
                    onClick={() => setExpanded(false)}
                    className="shrink-0 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
                  >
                    Inbox
                  </button>,
                ]
              : []),
            <span key="project" className="truncate text-muted-foreground">
              {project?.name}
            </span>,
            <span key="task" className="truncate font-medium">
              {task?.key}
            </span>,
          ]}
          actions={
            <div className="flex items-center gap-1 text-muted-foreground">
              <IconMessageCircle className="size-4" />
              <span className="text-xs tabular-nums">{comments.length}</span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-1"
                render={
                  <Link
                    to="/modes/collaboration"
                    search={{ view: "task", id: task?.id }}
                  />
                }
              >
                Open task
              </Button>
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
                aria-label="Task options"
              >
                <IconDots className="size-4" />
              </Button>
            </div>
          }
        />

        <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
          <div className="mx-auto flex w-full max-w-3xl flex-col px-4 py-4">
            {task !== undefined && (
              <>
                <div className="flex items-start gap-2.5">
                  <TaskStatusIcon status={task.status} className="mt-1" />
                  <h1 className="min-w-0 flex-1 text-lg font-semibold text-balance">
                    {task.title}
                  </h1>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-6.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <AssigneeAvatar name={task.assignee} />
                    {task.assignee}
                  </span>
                  {scope !== undefined && (
                    <span className="flex items-center gap-1.5">
                      <ScopeGlyph kind={scope.kind} />
                      {scope.name}
                    </span>
                  )}
                  <span className="tabular-nums">Updated {task.updated}</span>
                </div>
                {task.description.map((paragraph, index) => (
                  <p
                    key={index}
                    className="mt-3 max-w-[70ch] pl-6.5 text-sm text-pretty text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}
              </>
            )}

            <ul role="list" className="mt-6 flex flex-col gap-5 border-t pt-5">
              {comments.map((comment) => (
                <li key={comment.id} className="flex gap-3">
                  <Avatar name={comment.author} className="mt-0.5 size-7" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[0.8125rem] font-medium">
                        {comment.author}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {comment.time}
                      </span>
                    </div>
                    <p className="mt-1 max-w-[70ch] text-sm text-pretty">
                      {comment.body}
                    </p>
                  </div>
                </li>
              ))}
              {comments.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nothing said on this one yet.
                </li>
              )}
            </ul>
          </div>
        </ScrollArea>

        <MessageComposer
          placeholder={`Comment on ${task?.key ?? "this task"}`}
        />
      </section>
    </div>
  );
}
