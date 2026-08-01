import type { WorkMode } from "@/lib/ui-prefs"

/**
 * Which mode the app is in. Every mode-owned route is prefixed `/modes/<mode>`,
 * so the path names the mode outright; surfaces both modes share (the inbox,
 * settings) fall back to the last pick.
 */
export function activeWorkMode(pathname: string, stored: WorkMode): WorkMode {
  if (pathname.startsWith("/modes/collaboration")) return "collaboration"
  if (pathname.startsWith("/modes/code")) return "code"
  return stored
}
