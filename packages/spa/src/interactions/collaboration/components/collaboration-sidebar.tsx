/**
 * The collaboration mode's sidebar — a tree of projects that expand into their
 * open tasks and their channels, the team-wide channels below, and people in the
 * footer. It lives apart from the page so shared surfaces (the inbox) can keep
 * it on screen, and every row is a link so the selection survives navigating
 * away and back.
 */
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconHash,
  IconInbox,
  IconRobot,
  IconUsers,
} from "@tabler/icons-react"
import { Link, useRouterState } from "@tanstack/react-router"
import { useState, type CSSProperties, type ReactNode } from "react"
import { ResizeHandle } from "@/components/layout/resize-handle"
import { SidebarSearch } from "@/components/layout/sidebar-filters"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { TaskStatusIcon } from "@/interactions/collaboration/components/task-status-icon"
import {
  AGENTS,
  DEFAULT_ID,
  DEFAULT_VIEW,
  findChannel,
  findTask,
  MEMBERS,
  PROJECTS,
  projectChannels,
  projectTasks,
  TEAM_CHANNELS,
  WORKSPACES,
  type CollaborationView,
} from "@/interactions/collaboration/data/collaboration.mock"
import { UNREAD_COUNT } from "@/interactions/inbox/data/inbox.mock"
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"

const ROW =
  "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-lg pr-1.5 pl-1 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"

const INDENT = ["pl-1", "pl-5", "pl-9"]

function UnreadCount({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="ml-auto shrink-0 pl-1 text-[0.6875rem] font-medium text-foreground tabular-nums">
      {count}
    </span>
  )
}

function WorkspacePicker() {
  const [open, setOpen] = useState(false)
  const [id, setId] = useState(WORKSPACES[0]?.id)
  const selected = WORKSPACES.find((w) => w.id === id) ?? WORKSPACES[0]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-lg px-1.5 text-left text-[13px] font-medium outline-none hover:bg-elevate focus-visible:ring-3 focus-visible:ring-ring/30"
          />
        }
      >
        <span
          className="size-4 shrink-0 rounded-md bg-(--mark)"
          style={{ "--mark": selected?.color } as CSSProperties}
        />
        <span className="truncate">{selected?.name}</span>
        <IconChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 gap-0 p-1.5">
        {WORKSPACES.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => {
              setId(w.id)
              setOpen(false)
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-elevate focus-visible:bg-elevate"
          >
            <span
              className="size-5 shrink-0 rounded-md bg-(--mark)"
              style={{ "--mark": w.color } as CSSProperties}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">
                {w.name}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {w.detail}
              </span>
            </span>
            {w.id === selected?.id && <IconCheck className="size-4 shrink-0" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="flex flex-col gap-px px-2 pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex h-6 items-center gap-1 self-start rounded-md px-1.5 text-[0.6875rem] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
      >
        {title}
        <IconChevronDown
          className={cn(
            "size-3 transition-transform duration-100",
            !open && "-rotate-90"
          )}
        />
      </button>
      {open && children}
    </div>
  )
}

interface TreeRowProps {
  depth: number
  icon: ReactNode
  label: string
  to: string
  search?: { view: CollaborationView; id?: string }
  active: boolean
  trailing?: ReactNode
  expanded?: boolean
  onToggle?: () => void
}

function TreeRow({
  depth,
  icon,
  label,
  to,
  search,
  active,
  trailing,
  expanded,
  onToggle,
}: TreeRowProps) {
  return (
    <div
      className={cn(
        "group/row flex items-center gap-0.5 rounded-lg pr-1",
        INDENT[depth],
        active ? "bg-muted" : "hover:bg-elevate"
      )}
    >
      {onToggle === undefined ? (
        <span className="size-4 shrink-0" />
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded === true ? "Collapse" : "Expand"} ${label}`}
          className="grid size-4 shrink-0 place-items-center rounded text-muted-foreground outline-none hover:bg-elevate-strong hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          <IconChevronRight
            className={cn(
              "size-3 transition-transform duration-100",
              expanded === true && "rotate-90"
            )}
          />
        </button>
      )}
      <Link
        to={to}
        search={search}
        className={cn(
          ROW,
          active
            ? "text-foreground"
            : "text-muted-foreground group-hover/row:text-foreground"
        )}
      >
        {icon}
        <span className="truncate">{label}</span>
        {trailing}
      </Link>
    </div>
  )
}

export function CollaborationSidebar() {
  const prefs = useUiPrefs()
  const [width, setWidth] = useState(prefs.workspaceSidebarWidth)
  const [query, setQuery] = useState("")
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const { pathname, search } = useRouterState({ select: (s) => s.location })

  const onCollaboration = pathname.startsWith("/modes/collaboration")
  const current = search as { view?: CollaborationView; id?: string }
  const view = current.view ?? DEFAULT_VIEW
  const id = current.id ?? DEFAULT_ID

  const activeProjectId = !onCollaboration
    ? undefined
    : view === "project"
      ? id
      : view === "task"
        ? findTask(id)?.projectId
        : view === "channel"
          ? findChannel(id)?.projectId
          : undefined

  const q = query.trim().toLowerCase()
  const searching = q.length > 0
  const hit = (text: string) => text.toLowerCase().includes(q)

  const branches = PROJECTS.flatMap((project) => {
    const tasks = projectTasks(project.id).filter((t) => t.status !== "done")
    const channels = projectChannels(project.id)
    if (!searching) return [{ project, tasks, channels }]
    if (hit(project.name)) return [{ project, tasks, channels }]
    const matchedTasks = tasks.filter((t) => hit(t.title))
    const matchedChannels = channels.filter((c) => hit(c.name))
    if (matchedTasks.length === 0 && matchedChannels.length === 0) return []
    return [{ project, tasks: matchedTasks, channels: matchedChannels }]
  })
  const teamChannels = TEAM_CHANNELS.filter((c) => !searching || hit(c.name))

  const isOpen = (projectId: string) =>
    searching || (overrides[projectId] ?? projectId === activeProjectId)
  const toggle = (projectId: string) =>
    setOverrides((o) => ({ ...o, [projectId]: !isOpen(projectId) }))

  const isActive = (rowView: CollaborationView, rowId?: string) =>
    onCollaboration && view === rowView && (rowId === undefined || id === rowId)

  return (
    <>
      <aside className="flex shrink-0 flex-col border-r" style={{ width }}>
        <div className="flex flex-col gap-1 p-2">
          <WorkspacePicker />
          <SidebarSearch
            label="Search projects, tasks and channels"
            placeholder="Search"
            value={query}
            onChange={setQuery}
          />
          <Link
            to="/inbox"
            className={cn(
              "flex h-8 items-center gap-2 rounded-lg px-1.5 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
              pathname.startsWith("/inbox")
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-elevate hover:text-foreground"
            )}
          >
            <IconInbox className="size-4 shrink-0" />
            <span className="truncate">Inbox</span>
            <UnreadCount count={UNREAD_COUNT} />
          </Link>
        </div>

        <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
          <Section title="Projects">
            {branches.map(({ project, tasks, channels }) => (
              <div key={project.id} className="flex flex-col gap-px">
                <TreeRow
                  depth={0}
                  icon={
                    <span
                      className="size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)"
                      style={{ "--mark": project.color } as CSSProperties}
                    />
                  }
                  label={project.name}
                  to="/modes/collaboration"
                  search={{ view: "project", id: project.id }}
                  active={isActive("project", project.id)}
                  expanded={isOpen(project.id)}
                  onToggle={() => toggle(project.id)}
                />
                {isOpen(project.id) && (
                  <>
                    {tasks.map((task) => (
                      <TreeRow
                        key={task.id}
                        depth={1}
                        icon={<TaskStatusIcon status={task.status} />}
                        label={task.title}
                        to="/modes/collaboration"
                        search={{ view: "task", id: task.id }}
                        active={isActive("task", task.id)}
                      />
                    ))}
                    {channels.map((channel) => (
                      <TreeRow
                        key={channel.id}
                        depth={1}
                        icon={
                          <IconHash className="size-4 shrink-0 text-muted-foreground" />
                        }
                        label={channel.name}
                        to="/modes/collaboration"
                        search={{ view: "channel", id: channel.id }}
                        active={isActive("channel", channel.id)}
                        trailing={<UnreadCount count={channel.unread} />}
                      />
                    ))}
                  </>
                )}
              </div>
            ))}
            {branches.length === 0 && (
              <p className="px-2 py-1 text-[13px] text-muted-foreground">
                No projects match.
              </p>
            )}
          </Section>

          <Section title="Channels">
            {teamChannels.map((channel) => (
              <TreeRow
                key={channel.id}
                depth={0}
                icon={
                  <IconHash className="size-4 shrink-0 text-muted-foreground" />
                }
                label={channel.name}
                to="/modes/collaboration"
                search={{ view: "channel", id: channel.id }}
                active={isActive("channel", channel.id)}
                trailing={<UnreadCount count={channel.unread} />}
              />
            ))}
            {teamChannels.length === 0 && (
              <p className="px-2 py-1 text-[13px] text-muted-foreground">
                No channels match.
              </p>
            )}
          </Section>
        </ScrollArea>

        <div className="flex flex-col gap-px border-t p-2">
          <TreeRow
            depth={0}
            icon={<IconRobot className="size-4 shrink-0" />}
            label="Agents"
            to="/modes/collaboration"
            search={{ view: "agents" }}
            active={isActive("agents")}
            trailing={
              <span className="ml-auto shrink-0 pl-1 text-[0.6875rem] text-muted-foreground tabular-nums">
                {AGENTS.filter((a) => a.online).length}/{AGENTS.length}
              </span>
            }
          />
          <TreeRow
            depth={0}
            icon={<IconUsers className="size-4 shrink-0" />}
            label="Members"
            to="/modes/collaboration"
            search={{ view: "members" }}
            active={isActive("members")}
            trailing={
              <span className="ml-auto shrink-0 pl-1 text-[0.6875rem] text-muted-foreground tabular-nums">
                {MEMBERS.length}
              </span>
            }
          />
        </div>
      </aside>

      <ResizeHandle
        orientation="col"
        value={width}
        min={200}
        max={() => Math.max(260, window.innerWidth - 480)}
        onResize={setWidth}
        onResizeEnd={(w) => setUiPrefs({ workspaceSidebarWidth: w })}
        label="Resize sidebar"
      />
    </>
  )
}
