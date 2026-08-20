/**
 * The modes the app can be framed in, and how you move between them.
 *
 * Pure — the list, which mode a path is in, and which one comes next are all
 * decidable without a router or a rendered strip, so the tabs on the window bar
 * and the chord that cycles them read the same answers from here.
 */
import { isFeatureEnabled } from "@byconvo/feature-flags";
import type { WorkMode } from "@/lib/ui-prefs";

/**
 * One mode, as the bar draws it: what it is called, what it is for, and the
 * page its tab takes you to.
 *
 * `as const` rather than annotated, so `to` stays the literal the router knows
 * rather than widening to `string`.
 */
const CODE = {
  mode: "code",
  title: "Code",
  detail: "Focus on technical details in a detailed view",
  to: "/modes/code/browse",
} as const;

const COLLABORATION = {
  mode: "collaboration",
  title: "Collaboration",
  detail: "Collaborate with humans and agents",
  to: "/modes/collaboration",
} as const;

export type WorkModeTab = typeof CODE | typeof COLLABORATION;

/**
 * The modes on offer, in the order the strip draws them. Collaboration is
 * behind its flag; with it off there is one mode, and a strip of one tab is no
 * choice at all — see `ModeSelector`.
 */
export const workModeTabs = (): ReadonlyArray<WorkModeTab> =>
  isFeatureEnabled("collaboration-button") ? [CODE, COLLABORATION] : [CODE];

/**
 * Which mode the app is in. Every mode-owned route is prefixed `/modes/<mode>`,
 * so the path names the mode outright; surfaces both modes share (the inbox,
 * settings) fall back to the last pick. An agent session is a surface of its
 * own rather than a mode — it is the code you keep, so it is framed as code.
 */
export function activeWorkMode(pathname: string, stored: WorkMode): WorkMode {
  if (pathname.startsWith("/modes/collaboration")) return "collaboration";
  if (pathname.startsWith("/modes/code")) return "code";
  if (pathname.startsWith("/modes/agent-session")) return "code";
  return stored;
}

/**
 * The mode ⌘G moves to: the next one along, wrapping at the end, so the one
 * chord covers however many modes there are.
 *
 * Null when there is nowhere to go — a single mode, or none at all. A mode that
 * is not in the list (its flag went off while it was the stored pick) counts as
 * standing before the first, so the chord lands somewhere real.
 */
export function nextWorkMode(
  modes: ReadonlyArray<WorkModeTab>,
  active: WorkMode
): WorkModeTab | null {
  if (modes.length < 2) return null;
  const at = modes.findIndex((mode) => mode.mode === active);
  return modes[(at + 1) % modes.length] ?? null;
}
