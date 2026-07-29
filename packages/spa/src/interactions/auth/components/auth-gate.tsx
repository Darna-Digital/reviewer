/**
 * Stands between a signed-out visitor and the workspace.
 *
 * It renders the forms in place rather than redirecting, so arriving at a
 * workspace link and signing in leaves you exactly where you were headed —
 * no bounce through /sign-in and back, and no lost search params.
 */
import type { ReactNode } from "react"
import { useViewer } from "../adapters/auth.hook.adapter"
import { AuthForms } from "./auth-forms"

export function AuthGate({ children }: { children: ReactNode }) {
  const viewer = useViewer()

  if (viewer.status === "loading") {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-40 animate-pulse rounded-md bg-elevate" />
      </div>
    )
  }

  if (viewer.status === "signed-out") {
    return (
      <div className="flex flex-1 items-center justify-center overflow-y-auto p-6">
        <AuthForms />
      </div>
    )
  }

  return <>{children}</>
}
