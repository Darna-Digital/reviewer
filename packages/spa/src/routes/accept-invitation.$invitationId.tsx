/**
 * Where an invitation email lands.
 *
 * Accepting needs a session, so a signed-out visitor gets the sign-in card
 * first — with the invitation id still in the URL, so accepting picks up again
 * the moment they are in.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { AuthGate } from "@/interactions/auth/components/auth-gate"
import { authClient } from "@/lib/central/auth-client"
import { resetWorkspaceCollections } from "@/lib/central/collections"

export const Route = createFileRoute("/accept-invitation/$invitationId")({
  component: AcceptInvitationRoute,
})

function AcceptInvitationRoute() {
  const { invitationId } = Route.useParams()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const respond = async (accept: boolean) => {
    setBusy(true)
    try {
      const { error } = accept
        ? await authClient.organization.acceptInvitation({ invitationId })
        : await authClient.organization.rejectInvitation({ invitationId })
      if (error != null) throw new Error(error.message)
      if (accept) {
        // The new membership changes what the active organization is.
        resetWorkspaceCollections()
        await navigate({ to: "/workspace" })
      } else {
        toast.success("Invitation declined")
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "could not answer the invitation"
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex h-svh items-center justify-center p-6 text-foreground">
      <AuthGate>
        <div className="w-full max-w-sm rounded-xl border bg-surface-2 p-6 text-center shadow-surface-2">
          <h1 className="text-base font-medium">You have been invited</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Join the organization to see its projects, tasks and docs.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button disabled={busy} onClick={() => void respond(true)}>
              Accept invitation
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void respond(false)}
            >
              Decline
            </Button>
          </div>
        </div>
      </AuthGate>
    </main>
  )
}
