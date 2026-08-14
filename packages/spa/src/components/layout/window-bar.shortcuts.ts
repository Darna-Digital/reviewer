/**
 * The chords the window bar answers, read apart from the bar itself so they can
 * be settled without a rendered strip.
 *
 * ⌘<digit> runs along the bar in the order it is drawn: 1, 2 and 3 are the
 * three places it leads with — the launchpad, Code and Sessions — and 4 onwards
 * are the conversations after them, ⌘4 being the first. The three are fixed
 * rather than counted, so opening and closing sessions never moves them, and a
 * session keeps its digit for as long as it keeps its slot. ⌘T, minting a
 * session, is the one chord left on a letter, as in a browser.
 */
import { isFeatureEnabled } from "@byconvo/feature-flags";
import {
  PROJECT_TAB_ID,
  SESSIONS_TAB_ID,
} from "@/interactions/window-tabs/functions/window-tabs.functions";

export type BarShortcut =
  | { readonly kind: "new-session" }
  | { readonly kind: "launchpad" }
  /** Go to a pinned tab, wherever it was left. */
  | { readonly kind: "tab"; readonly tabId: string }
  /** Go to the session standing in that slot of the strip, counting from 1. */
  | { readonly kind: "session"; readonly slot: number };

type Chord = Pick<
  KeyboardEvent,
  "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

const FIRST_SESSION_DIGIT = 4;
const LAST_DIGIT = 9;

/** The digit a session in that slot answers to, once the bar has run out. */
export const sessionDigit = (slot: number): number | null => {
  const digit = slot + FIRST_SESSION_DIGIT - 1;
  return digit <= LAST_DIGIT ? digit : null;
};

/**
 * Sessions answers only while it leads the window. Switched off it keeps its
 * tab — the launchpad goes on listing it — but no more than the launchpad does,
 * which is why it is also out of the bar.
 */
const sessionsEnabled = (): boolean => isFeatureEnabled("sessions-button");

const placeAt = (digit: number): BarShortcut | null => {
  switch (digit) {
    case 1:
      return { kind: "launchpad" };
    case 2:
      return { kind: "tab", tabId: PROJECT_TAB_ID };
    case 3:
      return sessionsEnabled() ? { kind: "tab", tabId: SESSIONS_TAB_ID } : null;
    default:
      return digit >= FIRST_SESSION_DIGIT && digit <= LAST_DIGIT
        ? { kind: "session", slot: digit - FIRST_SESSION_DIGIT + 1 }
        : null;
  }
};

export function barShortcut(event: Chord): BarShortcut | null {
  if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === "t") return sessionsEnabled() ? { kind: "new-session" } : null;
  return placeAt(Number(key));
}
