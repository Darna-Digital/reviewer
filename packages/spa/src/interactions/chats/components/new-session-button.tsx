/**
 * Start a session, from the head of the sessions rail — where code mode's rail
 * puts the surface you land on, so the first thing in the column is the thing
 * that makes one.
 *
 * It does what the strip's own ✛ does: mints a session tab and goes to its
 * composer. Both are the same gesture, and one of them navigating in place
 * would spend whichever tab you were reading from — the sessions list among
 * them, which is the surface this button sits beside.
 *
 * The composer is loaded under the pointer rather than under the click. Every
 * `Link` in the app preloads on intent (`defaultPreload`), and a button that
 * navigates is a link as far as the reader is concerned — without it the click
 * has to fetch the route's code before the page can change, and the router goes
 * on showing whatever you were reading until it arrives. A blank composer
 * arriving late reads as the old page refusing to leave.
 */
import { IconPlus } from "@tabler/icons-react";
import { RailButton } from "@/components/layout/rail";
import { useWindowTabActions } from "@/interactions/window-tabs/adapters/window-tab-actions";
import { NEW_SESSION_HREF } from "@/interactions/window-tabs/functions/window-tabs.functions";

export function NewSessionButton() {
  const { openSession, prime } = useWindowTabActions();
  const warm = () => prime(NEW_SESSION_HREF);
  return (
    <RailButton
      label="New session"
      onPointerEnter={warm}
      onFocus={warm}
      onClick={() => void openSession()}
    >
      <IconPlus className="size-4" />
    </RailButton>
  );
}
