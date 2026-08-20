import type { WorkMode } from "@/lib/ui-prefs";

/**
 * Which mode the app is in. Every mode-owned route is prefixed `/modes/<mode>`,
 * so the path names the mode outright; surfaces both modes share (the inbox,
 * settings) fall back to the last pick. An agent session is a surface of its
 * own rather than a mode — it is the code you keep, so it is framed as code.
 */
export function activeWorkMode(pathname: string, stored: WorkMode): WorkMode {
  if (pathname.startsWith("/modes/collaboration")) return "collaboration";
  // The prototype is still collaboration, whatever prefix it was parked under.
  if (pathname.startsWith("/modes/experimentation")) return "collaboration";
  if (pathname.startsWith("/modes/code")) return "code";
  if (pathname.startsWith("/modes/agent-session")) return "code";
  return stored;
}
