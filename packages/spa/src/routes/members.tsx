import { createFileRoute } from "@tanstack/react-router"
import { SurfaceSwitch } from "@/components/layout/surface-switch"
import { AuthGate } from "@/interactions/auth/components/auth-gate"
import { MembersPage } from "@/interactions/auth/components/members-page"
import { isDesktop } from "@/lib/desktop"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/members")({
  component: MembersRoute,
})

function MembersRoute() {
  return (
    <div className="flex h-svh w-full flex-col overflow-hidden text-foreground">
      <header
        className={cn(
          "flex h-10 shrink-0 items-center gap-2 px-2",
          isDesktop && "pl-20 [-webkit-app-region:drag]"
        )}
      >
        <SurfaceSwitch />
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-lg border-t border-l">
        <AuthGate>
          <MembersPage />
        </AuthGate>
      </div>
    </div>
  )
}
