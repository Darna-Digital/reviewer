/**
 * The workspace's left rail: which organization you are in, which project you
 * are looking at, and who you are signed in as.
 *
 * Switching organization is the one control here that changes the meaning of
 * every id on screen, so it clears the client-side store rather than trying to
 * reconcile two tenants' rows.
 *
 * Below `md` the rail costs more width than the list can spare, so the same
 * content moves into a dialog behind {@link WorkspaceNavButton} — one body,
 * rendered in whichever container the width allows.
 */
import {
  IconCheck,
  IconChevronDown,
  IconLogout,
  IconMenu2,
  IconPlus,
  IconUsers,
} from "@tabler/icons-react"
import { useState } from "react"
import { toast } from "sonner"
import { initialsOf } from "@byconvo/core/identity"
import type { Project } from "@byconvo/core/projects"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { ProjectGlyph } from "./task-glyphs"

export interface WorkspaceSidebarProps {
  projects: ReadonlyArray<Project>
  activeProjectId: string | null
  onSelectProject: (id: string) => void
  onCreateProject: (name: string) => void
  onManageMembers: () => void
}

export function WorkspaceSidebar(props: WorkspaceSidebarProps) {
  return (
    <nav className="flex w-60 shrink-0 flex-col border-r border-foreground/10 bg-surface-1 max-md:hidden">
      <SidebarBody {...props} />
    </nav>
  )
}

/**
 * The rail's mobile form. Lives beside the project title in the header, where
 * the rail itself would be at this width.
 */
export function WorkspaceNavButton(props: WorkspaceSidebarProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open the workspace menu"
            className="shrink-0 text-muted-foreground md:hidden"
          />
        }
      >
        <IconMenu2 />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-w-xs gap-0 overflow-hidden p-0 sm:max-w-xs"
      >
        <DialogTitle className="sr-only">Workspace</DialogTitle>
        <div className="flex h-[70svh] flex-col">
          <SidebarBody
            {...props}
            onSelectProject={(id) => {
              props.onSelectProject(id)
              setOpen(false)
            }}
            onManageMembers={() => {
              props.onManageMembers()
              setOpen(false)
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SidebarBody({
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
  const user = session.data?.user ?? null

  const switchTo = async (organizationId: string) => {
    try {
      await authClient.organization.setActive({ organizationId })
      // Every project, task and doc id on screen belongs to the old tenant.
      resetWorkspaceCollections()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "could not switch organization"
      )
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-12 shrink-0 items-center gap-2 px-3 text-left hover:bg-elevate aria-expanded:bg-elevate">
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-md bg-brand-100 text-[0.625rem] font-semibold text-brand-800 dark:bg-brand-950 dark:text-brand-200"
          >
            {initialsOf(current?.name ?? "?")}
          </span>
          <span className="min-w-0 flex-1 truncate text-base font-medium sm:text-sm">
            {current?.name ?? "No organization"}
          </span>
          <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {(organizations.data ?? []).map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => void switchTo(org.id)}
            >
              <span className="min-w-0 flex-1 truncate">{org.name}</span>
              {org.id === current?.id && (
                <IconCheck className="size-4 shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onManageMembers}>
            <IconUsers className="size-4 shrink-0" />
            Members & invitations
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pt-3">
        <div className="flex h-7 items-center gap-1 px-2">
          <h2 className="text-base font-medium text-muted-foreground sm:text-sm">
            Projects
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
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
            className="mt-1"
          />
        )}

        {projects.length === 0 && !creating && (
          <p className="px-2 py-2 text-base/6 text-pretty text-muted-foreground sm:text-sm/6">
            No projects yet. Create one to start filing tasks.
          </p>
        )}

        <ul role="list" className="flex flex-col gap-0.5 pt-1">
          {projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                onClick={() => onSelectProject(project.id)}
                className={cn(
                  "flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-base sm:h-8 sm:text-sm",
                  project.id === activeProjectId
                    ? "bg-elevate-strong"
                    : "hover:bg-elevate",
                  project.archived && "text-muted-foreground"
                )}
              >
                <ProjectGlyph name={project.name} color={project.color} />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                <span className="shrink-0 font-mono text-sm text-muted-foreground tabular-nums sm:text-xs">
                  {project.key}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-14 shrink-0 items-center gap-2 border-t border-foreground/10 px-3 text-left hover:bg-elevate aria-expanded:bg-elevate">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[0.625rem] font-medium text-brand-800 dark:bg-brand-950 dark:text-brand-200"
          >
            {initialsOf(user?.name ?? "?")}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-base font-medium sm:text-sm">
              {user?.name ?? "Signed out"}
            </span>
            {user !== null && (
              <span className="truncate text-sm text-muted-foreground sm:text-xs">
                {user.email}
              </span>
            )}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuItem
            onClick={() => {
              void signOut().then(() => resetWorkspaceCollections())
            }}
          >
            <IconLogout className="size-4 shrink-0" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
