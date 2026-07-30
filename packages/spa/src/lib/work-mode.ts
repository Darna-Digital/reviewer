import type { WorkMode } from "@/lib/ui-prefs"

/**
 * Which mode the app is in. The route wins where it names one; surfaces both
 * modes share (the inbox, the new-chat composer) fall back to the last pick.
 */
export function activeWorkMode(pathname: string, stored: WorkMode): WorkMode {
  if (pathname.startsWith("/modes/collaboration")) return "collaboration"
  if (pathname.startsWith("/inbox") || pathname.startsWith("/new-chat"))
    return stored
  return "code"
}
