/**
 * The session, as the workspace needs to read it: who you are, which
 * organization is active, and what you may do in it.
 *
 * better-auth's client owns the session itself; this only derives the role,
 * which it does not expose directly — the active organization carries its
 * member list, and your role is your own row in it.
 */
import type { MemberRole } from "@byconvo/core/identity"
import { useActiveOrganization, useSession } from "@/lib/central/auth-client"

export type SessionState =
  | { readonly status: "loading" }
  | { readonly status: "signed-out" }
  | {
      readonly status: "signed-in"
      readonly userId: string
      readonly name: string
      readonly email: string
      readonly emailVerified: boolean
      readonly role: MemberRole | null
    }

export function useViewer(): SessionState {
  const session = useSession()
  const organization = useActiveOrganization()

  if (session.isPending) return { status: "loading" }
  const user = session.data?.user
  if (user === undefined) return { status: "signed-out" }

  const member = organization.data?.members?.find(
    (candidate) => candidate.userId === user.id
  )

  return {
    status: "signed-in",
    userId: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
    role: member?.role ?? null,
  }
}

/** The role alone, for the components that only gate on it. */
export function useViewerRole(): MemberRole | null {
  const viewer = useViewer()
  return viewer.status === "signed-in" ? viewer.role : null
}
