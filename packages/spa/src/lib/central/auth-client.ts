/**
 * better-auth's client, pointed at the central server.
 *
 * Sessions, sign-in, verification, organizations and invitations are all the
 * library's own endpoints, so this is the client for them rather than a second
 * hand-written wrapper around the same routes. The workspace domain — projects,
 * tasks, docs, labels, comments — goes through `centralClient` instead.
 */
import { organizationClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import { centralAuthBaseUrl } from "./client"

export const authClient = createAuthClient({
  baseURL: centralAuthBaseUrl,
  plugins: [organizationClient()],
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  organization,
  useListOrganizations,
  useActiveOrganization,
} = authClient

/** better-auth reports failures in the result; the forms want a thrown error. */
export const unwrapAuth = <T>(result: {
  data?: T | null
  error?: { message?: string } | null
}): T => {
  if (result.error != null) {
    throw new Error(result.error.message ?? "something went wrong")
  }
  return result.data as T
}
