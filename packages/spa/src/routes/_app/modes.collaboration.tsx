import { createFileRoute } from "@tanstack/react-router";
import { CollabShell } from "@/interactions/collab/components/collab-shell";

/**
 * The collaboration mode's layout. Everything under it is drawn in the shell's
 * centred column, with the hovering bar and its drawer above — see
 * `CollabShell` for why those live above the outlet rather than on each page.
 */
export const Route = createFileRoute("/_app/modes/collaboration")({
  component: CollabShell,
});
