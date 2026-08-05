/**
 * The collaboration mode's sidebar — collapsible sections, agents first and
 * members last, wrapped around favourites and a tree of projects that expand
 * into their tasks, docs and channels. Unread carries through the tree: a
 * channel that is waiting reads at full contrast, and a collapsed project
 * rolls its channels' counts up onto its own row so nothing waits out of
 * sight. It lives apart from the page so shared surfaces (the inbox) can keep
 * it on screen, and every row is a link so the selection survives navigating
 * away and back.
 */
import {
  IconChevronDown,
  IconChevronRight,
  IconCircleCheck,
  IconCloud,
  IconFileText,
  IconHash,
  IconLock,
  IconMessageCircle,
} from "@tabler/icons-react"
import { Link, useRouterState } from "@tanstack/react-router"
import { useState, type CSSProperties, type ReactNode } from "react"
import { ResizeHandle } from "@/components/layout/resize-handle"
import { Avatar } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AddAgentButton } from "@/interactions/collaboration/components/agent-add-dialog"
import { AgentHoverCard } from "@/interactions/collaboration/components/agent-hover-card"
import {
  AgentMark,
  AgentStateDot,
} from "@/interactions/collaboration/components/agent-mark"
import {
  agentName,
  DEFAULT_ID,
  DEFAULT_VIEW,
  FAVORITES,
  findChannel,
  findChat,
  findProject,
  findTask,
  MEMBERS,
  membershipOf,
  PROJECTS,
  projectChannels,
  projectTasks,
  VIEWER,
  visibleChats,
  type CollaborationView,
  type MockAgent,
  type MockChannel,
  type MockChat,
  type MockFavorite,
  type MockPerson,
  type MockProject,
  type MockTask,
} from "@/interactions/collaboration/data/collaboration.mock"
import { useAgents } from "@/interactions/collaboration/data/use-agents"
import { useChats } from "@/interactions/collaboration/data/use-chats"
import { setUiPrefs, useUiPrefs } from "@/lib/ui-prefs"
import { cn } from "@/lib/utils"

const ROW =
  "flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md pr-1.5 pl-1 text-[13px] outline-none focus-visible:ring-3 focus-visible:ring-ring/30"

const INDENT = ["pl-1", "pl-5", "pl-9"]

type PeopleView = Extract<CollaborationView, "agents" | "members">

interface FavoriteRow {
  view: MockFavorite["view"]
  id: string
  label: string
  icon: ReactNode
}

interface ProjectBranch {
  project: MockProject
  tasks: ReadonlyArray<MockTask>
  chats: ReadonlyArray<MockChat>
  channels: ReadonlyArray<MockChannel>
}

const projectMark = (project: MockProject) => (
  <span
    className="size-3.5 shrink-0 rounded-[0.3rem] bg-(--mark)"
    style={{ "--mark": project.color } as CSSProperties}
  />
)

const unreadIn = (channels: ReadonlyArray<MockChannel>) =>
  channels.reduce((total, channel) => total + channel.unread, 0)

/** Only chats you are actually in can be unread — reading one is not owing it. */
const unreadInChats = (chats: ReadonlyArray<MockChat>) =>
  chats.reduce(
    (total, chat) =>
      total + (membershipOf(chat) === "joined" ? chat.unread : 0),
    0
  )

function UnreadCount({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span className="ml-auto shrink-0 pl-1 text-[0.6875rem] font-medium text-foreground tabular-nums">
      {count}
    </span>
  )
}

/** Somebody is waiting on you to let them in — not an unread, so not a count. */
function PendingRequestDot({ count }: { count: number }) {
  if (count === 0) return null
  return (
    <span
      title={count === 1 ? "1 join request" : `${count} join requests`}
      className="ml-auto size-1.5 shrink-0 rounded-full bg-amber-500"
    />
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  /** Sits opposite the title, revealed on hover like a Linear section. */
  action?: ReactNode
  children: ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="group/section flex flex-col gap-px px-2 pt-3">
      <div className="flex items-center gap-1 pr-1">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex h-6 items-center gap-1 rounded-md px-1.5 text-[0.6875rem] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {title}
          <IconChevronDown
            className={cn(
              "size-3 transition-transform duration-100",
              !open && "-rotate-90"
            )}
          />
        </button>
        {action !== undefined && (
          <span className="ml-auto opacity-0 group-focus-within/section:opacity-100 group-hover/section:opacity-100">
            {action}
          </span>
        )}
      </div>
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
  /** Lifts an at-rest row to full contrast — unread, not a hover state. */
  strong?: boolean
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
  strong = false,
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
          active || strong
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
  view: PeopleView
  active: boolean
}) {
  return (
    <TreeRow
      depth={0}
      icon={
        <Avatar
          name={person.name}
          letters={1}
          className="size-4.5 text-[0.5rem]"
        />
      }
      label={person.name}
      to="/modes/collaboration"
      search={{ view, id: person.id }}
      active={active}
      trailing={<PresenceDot online={person.online} />}
    />
  )
}

function AgentRow({ agent, active }: { agent: MockAgent; active: boolean }) {
  return (
    <AgentHoverCard agent={agent} render={<div />}>
      <TreeRow
        depth={0}
        icon={<AgentMark kind={agent.kind} className="size-4.5 rounded" />}
        label={agentName(agent)}
        to="/modes/collaboration"
        search={{ view: "agents", id: agent.id }}
        active={active}
        trailing={
          <span className="ml-auto flex items-center gap-1.5">
            {agent.runtime === "cloud" && (
              <IconCloud className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <AgentStateDot running={agent.running} />
          </span>
        }
      />
    </AgentHoverCard>
  )
}

/**
 * A chat you have not joined still belongs in the tree — that is what public
 * means — but it stays at reading contrast and carries no unread, since nothing
 * in there is waiting on you until you are in it.
 */
function ChatRow({ chat, active }: { chat: MockChat; active: boolean }) {
  const membership = membershipOf(chat)
  const mine = chat.initiator === VIEWER.name

  return (
    <TreeRow
      depth={1}
      icon={
        chat.visibility === "private" ? (
          <IconLock className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <IconMessageCircle className="size-4 shrink-0 text-muted-foreground" />
        )
      }
      label={chat.title}
      to="/modes/collaboration"
      search={{ view: "chat", id: chat.id }}
      active={active}
      trailing={
        mine && chat.requests.length > 0 ? (
          <PendingRequestDot count={chat.requests.length} />
        ) : membership === "joined" ? (
          <UnreadCount count={chat.unread} />
        ) : membership === "requested" ? (
          <span className="ml-auto shrink-0 pl-1 text-[0.6875rem] text-muted-foreground">
            asked
          </span>
        ) : undefined
      }
      strong={membership === "joined" && chat.unread > 0}
    />
  )
}

function PeopleSection({
  title,
  people,
  view,
  isActive,
}: {
  title: string
  people: ReadonlyArray<MockPerson>
  view: PeopleView
  isActive: (view: CollaborationView, id?: string) => boolean
}) {
  return (
    <Section title={title}>
      {people.map((person) => (
        <PersonRow
          key={person.id}
          person={person}
          view={view}
          active={isActive(view, person.id)}
        />
      ))}
    </Section>
  )
}

/**
 * A project row plus its tasks, docs and channels when expanded. Collapsed, it
 * carries its channels' unread total so the count does not disappear with them.
 */
function ProjectBranchRows({
  branch: { project, tasks, chats, channels },
  expanded,
  onToggle,
  isActive,
}: {
  branch: ProjectBranch
  expanded: boolean
  onToggle: () => void
  isActive: (view: CollaborationView, id?: string) => boolean
}) {
  return (
    <div className="flex flex-col gap-px">
      <TreeRow
        depth={0}
        icon={projectMark(project)}
        label={project.name}
        to="/modes/collaboration"
        search={{ view: "project", id: project.id }}
        active={isActive("project", project.id)}
        expanded={expanded}
        onToggle={onToggle}
        trailing={
          expanded ? undefined : (
            <UnreadCount count={unreadIn(channels) + unreadInChats(chats)} />
          )
        }
      />
      {expanded && (
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
          {chats.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              active={isActive("chat", chat.id)}
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
              strong={channel.unread > 0}
            />
          ))}
        </>
      )}
    </div>
  )
}

export function CollaborationSidebar() {
  const prefs = useUiPrefs()
  const [width, setWidth] = useState(prefs.workspaceSidebarWidth)
  const agents = useAgents()
  useChats()
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
          : view === "chat"
            ? findChat(id)?.projectId
            : undefined

  const branches: ReadonlyArray<ProjectBranch> = PROJECTS.map((project) => ({
    project,
    tasks: projectTasks(project.id).filter((t) => t.status !== "done"),
    chats: visibleChats(project.id),
    channels: projectChannels(project.id),
  }))

  const favorites: ReadonlyArray<FavoriteRow> = FAVORITES.map((favorite) => {
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
          projectMark(project)
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
          <Section title="Agents" action={<AddAgentButton compact />}>
            {agents.map((agent) => (
              <AgentRow
                key={agent.id}
                agent={agent}
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
            {branches.map((branch) => (
              <ProjectBranchRows
                key={branch.project.id}
                branch={branch}
                expanded={isOpen(branch.project.id)}
                onToggle={() => toggle(branch.project.id)}
                isActive={isActive}
              />
            ))}
          </Section>

          <PeopleSection
            title="Members"
            people={MEMBERS}
            view="members"
            isActive={isActive}
          />
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
