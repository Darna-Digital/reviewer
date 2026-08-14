/**
 * The collaboration strip, over the surface it holds. It sits where code mode's
 * open-file strip sits — the first row of the content pane, under the toolbar
 * and above the surface's own header — so the two modes are the same furniture
 * with different contents in it. Each tab wears the icon its surface wears
 * elsewhere in the mode — the project's mark, a task's status — so a glance
 * along the strip reads as a list of places rather than of titles.
 *
 * Tabs follow navigation: picking something in the sidebar re-points the active
 * tab, and `+` is what opens another. Drag reorders, middle-click closes.
 */
import {
  IconCircleCheck,
  IconFileText,
  IconInbox,
  IconMessage,
  IconPlus,
  IconRobot,
  IconUsers,
} from "@tabler/icons-react";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import {
  TAB_STRIP,
  TabClose,
  tabChipClass,
} from "@/components/layout/tab-chip";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon";
import {
  findProject,
  findTask,
} from "@/interactions/collaboration/data/collaboration.mock";
import {
  nextTabId,
  updateCollaborationTabs,
  useCollaborationTabs,
} from "../adapters/collaboration-tabs.store";
import {
  closeTab,
  COLLABORATION_PATH,
  DEFAULT_HREF,
  DEFAULT_PLACE,
  describeLocation,
  moveTab,
  openTab,
  selectTab,
  trackLocation,
} from "../functions/collaboration-tabs.functions";
import type {
  CollaborationTab,
  CollaborationTabKind,
} from "../interfaces/collaboration-tabs.interfaces";

const KIND_ICON: Partial<Record<CollaborationTabKind, typeof IconInbox>> = {
  inbox: IconInbox,
  tasks: IconCircleCheck,
  docs: IconFileText,
  chat: IconMessage,
  agents: IconRobot,
  members: IconUsers,
};

function TabIcon({ tab }: { readonly tab: CollaborationTab }) {
  const project = tab.kind === "project" ? findProject(tab.subject) : undefined;
  if (project !== undefined) {
    return (
      <span
        className="size-4 shrink-0 rounded-[0.3rem] bg-(--mark)"
        style={{ "--mark": project.color } as CSSProperties}
      />
    );
  }
  const task = tab.kind === "task" ? findTask(tab.subject) : undefined;
  if (task !== undefined) return <TaskStatusIcon status={task.status} />;
  const Icon = KIND_ICON[tab.kind] ?? IconCircleCheck;
  return <Icon className="size-4 shrink-0" />;
}

export function CollaborationTabs() {
  const router = useRouter();
  const location = useRouterState({ select: (s) => s.location });
  const { tabs, activeId } = useCollaborationTabs();
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

  const { pathname, href, search } = location;
  const onCollaboration = pathname.startsWith(COLLABORATION_PATH);
  useEffect(() => {
    if (!onCollaboration) return;
    const place = describeLocation(pathname, search);
    updateCollaborationTabs((state) => trackLocation(state, href, place));
  }, [onCollaboration, pathname, href, search]);

  const open = () => {
    updateCollaborationTabs((state) =>
      openTab(state, { id: nextTabId(), href: DEFAULT_HREF, ...DEFAULT_PLACE })
    );
    go(DEFAULT_HREF);
  };

  const close = (id: string) => {
    updateCollaborationTabs((state) => {
      const next = closeTab(state, id);
      if (next.activeId !== state.activeId) {
        const landing = next.tabs.find((tab) => tab.id === next.activeId);
        if (landing !== undefined) go(landing.href);
      }
      return next;
    });
  };

  return (
    <div className="flex min-w-0 shrink-0 items-center gap-1 border-b border-border bg-background px-2 py-1">
      <div role="tablist" aria-label="Open surfaces" className={TAB_STRIP}>
        {tabs.map((tab, index) => {
          const active = tab.id === activeId && onCollaboration;
          return (
            <Tooltip key={tab.id} disabled={dragging !== null}>
              <TooltipTrigger
                render={
                  <div
                    role="tab"
                    aria-selected={active}
                    aria-label={tab.title}
                    tabIndex={active ? 0 : -1}
                    draggable
                    className={tabChipClass(active, dragging === tab.id)}
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
                      if (held !== tab.id) {
                        updateCollaborationTabs((state) =>
                          moveTab(state, held, index)
                        );
                      }
                    }}
                    onDragEnd={endDrag}
                    onDrop={(event) => {
                      event.preventDefault();
                      endDrag();
                    }}
                    onClick={(event) => {
                      // Shift-click closes, so a tab can go without aiming for
                      // its ✕.
                      if (event.shiftKey) {
                        event.preventDefault();
                        close(tab.id);
                        return;
                      }
                      updateCollaborationTabs((state) =>
                        selectTab(state, tab.id)
                      );
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
                        updateCollaborationTabs((state) =>
                          selectTab(state, tab.id)
                        );
                        go(tab.href);
                      }
                    }}
                  />
                }
              >
                <TabIcon tab={tab} />
                <span className="truncate">{tab.title}</span>
                {tabs.length > 1 && (
                  <TabClose
                    label={`Close ${tab.title}`}
                    active={active}
                    onClose={() => close(tab.id)}
                  />
                )}
              </TooltipTrigger>
              <TooltipContent side="bottom">{tab.title}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="New tab"
              onClick={open}
              className="shrink-0 text-muted-foreground"
            />
          }
        >
          <IconPlus className="size-5" />
        </TooltipTrigger>
        <TooltipContent side="bottom">New tab</TooltipContent>
      </Tooltip>
    </div>
  );
}
