/**
 * WorkspacePicker — the collaboration workspace chip in the title bar, beside
 * the mode selector. It opens the account menu: who is signed in, the
 * workspace-level actions, and a submenu that switches between the workspaces
 * on this account. Which workspace is open is prototype-local state.
 */
import { IconCheck, IconChevronDown } from "@tabler/icons-react"
import { useNavigate } from "@tanstack/react-router"
import { useState, type CSSProperties } from "react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  VIEWER,
  WORKSPACES,
  type MockWorkspace,
} from "@/interactions/collaboration/data/collaboration.mock"
import { cn } from "@/lib/utils"

function WorkspaceMark({
  workspace,
  className,
}: {
  workspace: MockWorkspace
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md bg-(--mark) text-[0.625rem] font-bold text-black/65",
        className
      )}
      style={{ "--mark": workspace.color } as CSSProperties}
    >
      {workspace.name.slice(0, 1)}
    </span>
  )
}

export function WorkspacePicker() {
  const navigate = useNavigate()
  const [id, setId] = useState(WORKSPACES[0]?.id)
  const selected = WORKSPACES.find((w) => w.id === id) ?? WORKSPACES[0]

  if (!selected) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="max-w-56 gap-2 rounded-full px-3.5 py-1.5"
          />
        }
      >
        <WorkspaceMark workspace={selected} className="size-4.5" />
        <span className="truncate">{selected.name}</span>
        <IconChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar name={VIEWER.name} className="size-8 text-xs" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">
              {VIEWER.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {VIEWER.email}
            </span>
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void navigate({ to: "/settings" })}>
          Settings
          <DropdownMenuShortcut className="tracking-normal">
            G then S
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            void navigate({
              to: "/modes/collaboration",
              search: { view: "members" },
            })
          }
        >
          Invite and manage members
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            Switch workspace
            <DropdownMenuShortcut className="tracking-normal">
              O then W
            </DropdownMenuShortcut>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{VIEWER.email}</DropdownMenuLabel>
              {WORKSPACES.map((w, index) => (
                <DropdownMenuItem key={w.id} onClick={() => setId(w.id)}>
                  <WorkspaceMark workspace={w} />
                  <span className="min-w-0 flex-1 truncate">{w.name}</span>
                  {w.id === selected.id && <IconCheck className="size-4" />}
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Account</DropdownMenuLabel>
              <DropdownMenuItem>Create or join a workspace…</DropdownMenuItem>
              <DropdownMenuItem>Add an account…</DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem>
          Log out
          <DropdownMenuShortcut className="tracking-normal">
            ⌥ ⇧ Q
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
