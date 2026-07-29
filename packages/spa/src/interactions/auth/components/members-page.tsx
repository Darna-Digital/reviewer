/**
 * Who is in the organization, and inviting more of them.
 *
 * Roles are shown to everyone but only editable by an admin, and the owner's
 * row is not editable at all — an organization that can lose its last owner is
 * an organization nobody can administer.
 */
import { IconMail, IconTrash } from "@tabler/icons-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  ROLE_LABEL,
  canManageMembers,
  initialsOf,
  type MemberRole,
} from "@byconvo/core/identity"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { authClient, useActiveOrganization } from "@/lib/central/auth-client"
import { useViewer } from "../adapters/auth.hook.adapter"

const INVITABLE_ROLES: ReadonlyArray<MemberRole> = ["admin", "member"]

const report = (error: unknown, fallback: string) =>
  toast.error(error instanceof Error ? error.message : fallback)

export function MembersPage() {
  const viewer = useViewer()
  const organization = useActiveOrganization()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<MemberRole>("member")
  const [busy, setBusy] = useState(false)
  const [invitations, setInvitations] = useState<
    ReadonlyArray<{ id: string; email: string; role: string; status: string }>
  >([])

  const manage =
    viewer.status === "signed-in" && viewer.role !== null
      ? canManageMembers(viewer.role)
      : false

  const refreshInvitations = () => {
    void authClient.organization.listInvitations().then(
      (result) => setInvitations(result.data ?? []),
      () => setInvitations([])
    )
  }

  useEffect(refreshInvitations, [organization.data?.id])

  const invite = async () => {
    if (email.trim().length === 0) return
    setBusy(true)
    try {
      const { error } = await authClient.organization.inviteMember({
        email: email.trim(),
        role,
      })
      if (error != null) throw new Error(error.message)
      toast.success(`Invitation sent to ${email.trim()}`)
      setEmail("")
      refreshInvitations()
    } catch (error) {
      report(error, "could not send the invitation")
    } finally {
      setBusy(false)
    }
  }

  const members = organization.data?.members ?? []
  const pending = invitations.filter((row) => row.status === "pending")

  return (
    <div className="mx-auto w-full max-w-2xl overflow-y-auto p-6">
      <h1 className="text-base font-medium">
        {organization.data?.name ?? "Organization"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone here can see and edit this organization's projects.
      </p>

      {manage && (
        <div className="mt-5 flex items-center gap-2">
          <Input
            type="email"
            value={email}
            placeholder="teammate@example.com"
            aria-label="Email to invite"
            onChange={(event) => setEmail(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void invite()
              }
            }}
            className="h-8 max-w-xs"
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >
              {ROLE_LABEL[role]}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {INVITABLE_ROLES.map((candidate) => (
                <DropdownMenuItem
                  key={candidate}
                  onClick={() => setRole(candidate)}
                >
                  {ROLE_LABEL[candidate]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            disabled={busy || email.trim().length === 0}
            onClick={() => void invite()}
            data-icon="inline-start"
          >
            <IconMail />
            Invite
          </Button>
        </div>
      )}

      <section className="mt-5">
        <h2 className="text-xs font-medium text-muted-foreground">Members</h2>
        <div className="mt-2 overflow-hidden rounded-lg border">
          {members.map((member) => {
            const isOwner = member.role === "owner"
            return (
              <div
                key={member.id}
                className="flex h-12 items-center gap-3 border-b px-3 last:border-b-0"
              >
                <span
                  aria-hidden
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-elevate-strong text-[11px] font-medium"
                >
                  {initialsOf(member.user.name || member.user.email)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {member.user.name || member.user.email}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.user.email}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABEL[member.role] ?? member.role}
                </span>
                {manage && !isOwner && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove ${member.user.email}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      void authClient.organization
                        .removeMember({ memberIdOrEmail: member.id })
                        .then(
                          () => organization.refetch?.(),
                          (error: unknown) =>
                            report(error, "could not remove the member")
                        )
                    }}
                  >
                    <IconTrash />
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {pending.length > 0 && (
        <section className="mt-5">
          <h2 className="text-xs font-medium text-muted-foreground">
            Pending invitations
          </h2>
          <div className="mt-2 overflow-hidden rounded-lg border">
            {pending.map((invitation) => (
              <div
                key={invitation.id}
                className="flex h-10 items-center gap-3 border-b px-3 text-sm last:border-b-0"
              >
                <span className="min-w-0 flex-1 truncate">
                  {invitation.email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABEL[invitation.role as MemberRole] ?? invitation.role}
                </span>
                {manage && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      void authClient.organization
                        .cancelInvitation({ invitationId: invitation.id })
                        .then(refreshInvitations, (error: unknown) =>
                          report(error, "could not cancel the invitation")
                        )
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
