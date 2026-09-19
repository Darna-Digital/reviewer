/**
 * The chords the window bar answers, read apart from the bar itself so they can
 * be settled without a rendered strip.
 *
 * ⌘<digit> is the strip's own: ⌘1 is the first conversation on it, and the run
 * carries on to ⌘9. The digits belong to the tabs alone — the places the bar
 * leads with are ways of working rather than tabs among them, so taking one of
 * them off the digits keeps the run counting what a tab strip counts.
 *
 * ⌘G is how you cross between those ways of working — Code and Sessions — the
 * way ⌘<digit> moves along the tabs within one. It steps along whichever of them
 * the strip is currently leading with, so a mode switched off drops out of the
 * run rather than leaving a gap in it.
 *
 * The launchpad is off the bar — it is reached by the handle under it — so it is
 * off the run of digits too: it answers to ⌘L, beside ⌘T for a new session, the
 * two chords that are about the window rather than about a place in it.
 *
 * The project chip is what every tab in the strip is scoped to rather than a
 * place among them, so it takes ⇧ as its mark — ⌘⇧P, as the content search
 * takes ⌘⇧F.
 */
import { isFeatureEnabled } from "@reviewer/feature-flags";

export type BarShortcut =
  | { readonly kind: "new-session" }
  | { readonly kind: "launchpad" }
  /** Raise the project chip's dropdown, to switch what the window is on. */
  | { readonly kind: "project-picker" }
  /** Cross to the next way of working the bar leads with. */
  | { readonly kind: "mode" }
  /** Go to the session standing in that slot of the strip, counting from 1. */
  | { readonly kind: "session"; readonly slot: number };

type Chord = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

const FIRST_DIGIT = 1;
const LAST_DIGIT = 9;

/** The digit a session in that slot answers to, once the strip has run out. */
export const sessionDigit = (slot: number): number | null => {
  const digit = slot + FIRST_DIGIT - 1;
  return digit <= LAST_DIGIT ? digit : null;
};

/**
 * Sessions answers only while it leads the window. Switched off it keeps its
 * tab — the launchpad goes on listing it — but no more than the launchpad does,
 * which is why it is also out of the bar.
 */
const sessionsEnabled = (): boolean => isFeatureEnabled("sessions-button");

const sessionAt = (digit: number): BarShortcut | null =>
  digit >= FIRST_DIGIT && digit <= LAST_DIGIT
    ? { kind: "session", slot: digit - FIRST_DIGIT + 1 }
    : null;

const DIGIT = /^[0-9]$/;

export function barShortcut(event: Chord): BarShortcut | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey) return null;
  const key = event.key.toLowerCase();
  if (event.shiftKey) return key === "p" ? { kind: "project-picker" } : null;
  if (key === "g") return { kind: "mode" };
  if (key === "l") return { kind: "launchpad" };
  if (key === "t") return sessionsEnabled() ? { kind: "new-session" } : null;
  // Tested rather than coerced: `Number(" ")` is a digit, and Space is not a
  // chord this bar has any business answering.
  return DIGIT.test(key) ? sessionAt(Number(key)) : null;
}
