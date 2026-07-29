/**
 * The workspace's left rail: which organization you are in, which project you
 * are looking at, and who you are signed in as.
 *
 * Switching organization is the one control here that changes the meaning of
 * every id on screen, so it clears the client-side store rather than trying to
 * reconcile two tenants' rows.
 */
import {
  IconCheck,
  IconChevronDown,
  IconLogout,
  IconPlus,
  IconUsers,
} from "@tabler/icons-react"
import { useState } from "react"
import { toast } from "sonner"
import { initialsOf } from "@byconvo/core/identity"
import type { Project } from "@byconvo/core/projects"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  authClient,
  signOut,
  useListOrganizations,
  useSession,
} from "@/lib/central/auth-client"
import { resetWorkspaceCollections } from "@/lib/central/collections"
import { cn } from "@/lib/utils"
import { ProjectGlyph } from "./issue-glyphs"

export interface WorkspaceSidebarProps {
  projects: ReadonlyArray<Project>
  activeProjectId: string | null
  onSelectProject: (id: string) => void
  onCreateProject: (name: string) => void
  onManageMembers: () => void
}

export function WorkspaceSidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onManageMembers,
}: WorkspaceSidebarProps) {
  const session = useSession()
  const organizations = useListOrganizations()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")

  const active = session.data?.session.activeOrganizationId ?? null
  const current =
    organizations.data?.find((org) => org.id === active) ??
    organizations.data?.[0] ??
    null

  const switchTo = async (organizationId: string) => {
    try {
      await authClient.organization.setActive({ organizationId })
      // Every project, issue and doc id on screen belongs to the old tenant.
      resetWorkspaceCollections()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not switch organization"
      )
    }
  }

  return (
    <nav className="flex w-56 shrink-0 flex-col border-r bg-surface-1">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-10 shrink-0 items-center gap-2 px-2 text-left hover:bg-elevate">
          <span
            aria-hidden
            className="flex size-5 items-center justify-center rounded-md bg-elevate-strong text-[10px] font-semibold"
          >
            {initialsOf(current?.name ?? "?")}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {current?.name ?? "No organization"}
          </span>
          <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {(organizations.data ?? []).map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => void switchTo(org.id)}
            >
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === current?.id && <IconCheck className="size-3.5" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onManageMembers}>
            <IconUsers className="size-3.5" />
            Members & invitations
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-1.5 pt-2">
        <div className="flex h-6 items-center gap-1 px-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Projects
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="New project"
            className="ml-auto text-muted-foreground"
            onClick={() => setCreating(true)}
          >
            <IconPlus />
          </Button>
        </div>

        {creating && (
          <Input
            autoFocus
            value={name}
            placeholder="Project name"
            aria-label="Project name"
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              if (name.trim().length === 0) setCreating(false)
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && name.trim().length > 0) {
                event.preventDefault()
                onCreateProject(name)
                setName("")
                setCreating(false)
              }
              if (event.key === "Escape") setCreating(false)
            }}
            className="mt-1 h-7"
          />
        )}

        {projects.length === 0 && !creating && (
          <p className="px-1.5 py-2 text-xs text-muted-foreground">
            No projects yet. Create one to start filing issues.
          </p>
        )}

        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => onSelectProject(project.id)}
            className={cn(
              "mt-0.5 flex h-7 items-center gap-2 rounded-md px-1.5 text-left text-[13px]",
              project.id === activeProjectId
                ? "bg-elevate-strong font-medium"
                : "hover:bg-elevate",
              project.archived && "text-muted-foreground"
            )}
          >
            <ProjectGlyph name={project.name} color={project.color} />
            <span className="min-w-0 flex-1 truncate">{project.name}</span>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {project.key}
            </span>
          </button>
        ))}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-10 shrink-0 items-center gap-2 border-t px-2 text-left hover:bg-elevate">
          <span
            aria-hidden
            className="flex size-5 items-center justify-center rounded-full bg-elevate-strong text-[10px] font-medium"
          >
            {initialsOf(session.data?.user.name ?? "?")}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px]">
            {session.data?.user.name ?? "Signed out"}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem
            onClick={() => {
              void signOut().then(() => resetWorkspaceCollections())
            }}
          >
            <IconLogout className="size-3.5" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
