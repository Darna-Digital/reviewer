/**
 * The collaboration mode's sidebar — collapsible sections, agents first and
 * members last, wrapped around favourites and a tree of projects that expand
 * into their tasks, docs and channels. It lives apart from the page so shared
 * surfaces (the inbox) can keep it on screen, and every row is a link so the
 * selection survives navigating away and back.
 */
import {
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconFileText,
  IconHash,
} from "@tabler/icons-react"
import { Link, useRouterState } from "@tanstack/react-router"
import { useState, type CSSProperties, type ReactNode } from "react"
import { ResizeHandle } from "@/components/layout/resize-handle"
import { Avatar } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AGENTS,
  DEFAULT_ID,
  DEFAULT_VIEW,
  FAVORITES,
  findChannel,
  findProject,
  findTask,
  MEMBERS,
  PROJECTS,
  projectChannels,
  projectTasks,
  type CollaborationView,
  type MockPerson,
} from "@/interactions/collaboration/data/collaboration.mock"
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"

const ROW =
  "flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md pr-1.5 pl-1 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"

const INDENT = ["pl-1", "pl-5", "pl-9"]

function UnreadCount({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="ml-auto shrink-0 pl-1 text-[0.6875rem] font-medium text-foreground tabular-nums">
      {count}
    </span>
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
        "group/row flex items-center gap-0.5 rounded-md pr-1",
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

function PresenceDot({ online }: { online: boolean }) {
  return (
    <span
      className={cn(
        "ml-auto size-1.5 shrink-0 rounded-full",
        online ? "bg-emerald-500" : "bg-muted-foreground/40"
      )}
    />
  )
}

function PersonRow({
  person,
  view,
  active,
}: {
  person: MockPerson
  view: Extract<CollaborationView, "agents" | "members">
  active: boolean
}) {
  return (
    <TreeRow
      depth={0}
      icon={<Avatar name={person.name} letters={1} className="size-4" />}
      label={person.name}
      to="/modes/collaboration"
      search={{ view, id: person.id }}
      active={active}
      trailing={<PresenceDot online={person.online} />}
    />
  )
}

export function CollaborationSidebar() {
  const prefs = useUiPrefs()
  const [width, setWidth] = useState(prefs.workspaceSidebarWidth)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const { pathname, search } = useRouterState({ select: (s) => s.location })

  const onCollaboration = pathname.startsWith("/modes/collaboration")
  const current = search as { view?: CollaborationView; id?: string }
  const view = current.view ?? DEFAULT_VIEW
  const id = current.id ?? DEFAULT_ID

  const activeProjectId = !onCollaboration
    ? undefined
    : view === "project" || view === "tasks" || view === "docs"
      ? id
      : view === "task"
        ? findTask(id)?.projectId
        : view === "channel"
          ? findChannel(id)?.projectId
          : undefined

  const branches = PROJECTS.map((project) => ({
    project,
    tasks: projectTasks(project.id).filter((t) => t.status !== "done"),
    channels: projectChannels(project.id),
  }))

  const favorites = FAVORITES.map((favorite) => {
    if (favorite.view === "channel") {
      const channel = findChannel(favorite.id)
      return channel === undefined
        ? null
        : {
            ...favorite,
            label: channel.name,
            icon: (
              <IconHash className="size-4 shrink-0 text-muted-foreground" />
            ),
          }
    }
    const project = findProject(favorite.id)
    if (project === undefined) return null
    return {
      ...favorite,
      label: favorite.view === "tasks" ? `${project.name} tasks` : project.name,
      icon:
        favorite.view === "tasks" ? (
          <IconCircleCheck className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <span
            className="size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)"
            style={{ "--mark": project.color } as CSSProperties}
          />
        ),
    }
  }).filter((f) => f !== null)

  const isOpen = (projectId: string) =>
    overrides[projectId] ?? projectId === activeProjectId
  const toggle = (projectId: string) =>
    setOverrides((o) => ({ ...o, [projectId]: !isOpen(projectId) }))

  const isActive = (rowView: CollaborationView, rowId?: string) =>
    onCollaboration && view === rowView && (rowId === undefined || id === rowId)

  return (
    <>
      <aside className="flex shrink-0 flex-col border-r" style={{ width }}>
        <ScrollArea className="min-h-0 flex-1" viewportClassName="scroll-fade">
          <Section title="Agents">
            {AGENTS.map((agent) => (
              <PersonRow
                key={agent.id}
                person={agent}
                view="agents"
                active={isActive("agents", agent.id)}
              />
            ))}
          </Section>

          {favorites.length > 0 && (
            <Section title="Favorites">
              {favorites.map((favorite) => (
                <TreeRow
                  key={`${favorite.view}-${favorite.id}`}
                  depth={0}
                  icon={favorite.icon}
                  label={favorite.label}
                  to="/modes/collaboration"
                  search={{ view: favorite.view, id: favorite.id }}
                  active={isActive(favorite.view, favorite.id)}
                />
              ))}
            </Section>
          )}

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
                    <TreeRow
                      depth={1}
                      icon={
                        <IconCircleCheck className="size-4 shrink-0 text-muted-foreground" />
                      }
                      label="Tasks"
                      to="/modes/collaboration"
                      search={{ view: "tasks", id: project.id }}
                      active={isActive("tasks", project.id)}
                      trailing={<UnreadCount count={tasks.length} />}
                    />
                    <TreeRow
                      depth={1}
                      icon={
                        <IconFileText className="size-4 shrink-0 text-muted-foreground" />
                      }
                      label="Docs"
                      to="/modes/collaboration"
                      search={{ view: "docs", id: project.id }}
                      active={isActive("docs", project.id)}
                    />
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

          <Section title="Members">
            {MEMBERS.map((member) => (
              <PersonRow
                key={member.id}
                person={member}
                view="members"
                active={isActive("members", member.id)}
              />
            ))}
          </Section>
        </ScrollArea>
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
