import type { WorkMode } from "@/lib/ui-prefs"

/**
 * Which mode the app is in. The route wins where it names one; surfaces both
 * modes share (the inbox) fall back to the last pick.
 */
export function activeWorkMode(pathname: string, stored: WorkMode): WorkMode {
  if (pathname.startsWith("/modes/collaboration")) return "collaboration"
  if (pathname.startsWith("/inbox")) return stored
  return "code"
}
