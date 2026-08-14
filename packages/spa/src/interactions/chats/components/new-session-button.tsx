/**
 * Start a session, from the head of the sessions rail — where code mode's rail
 * puts the surface you land on, so the first thing in the column is the thing
 * that makes one.
 *
 * The composer is loaded under the pointer rather than under the click. Every
 * `Link` in the app preloads on intent (`defaultPreload`), and a button that
 * navigates is a link as far as the reader is concerned — without it the click
 * has to fetch the route's code before the page can change, and the router goes
 * on showing whatever you were reading until it arrives. A blank composer
 * arriving late reads as the old page refusing to leave.
 */
import { IconPencilPlus } from "@tabler/icons-react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { RailButton } from "@/components/layout/rail";
import {
  NEW_SESSION,
  setChatMode,
} from "@/interactions/chats/adapters/chat-mode.store";

const NEW_SESSION_ROUTE = {
  to: "/modes/agent-session",
  search: { new: true },
} as const;

export function NewSessionButton() {
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <RailButton
      label="New session"
      // A route that declines to preload is one the click will load itself.
      onPointerEnter={() =>
        void router.preloadRoute(NEW_SESSION_ROUTE).catch(() => {})
      }
      onFocus={() =>
        void router.preloadRoute(NEW_SESSION_ROUTE).catch(() => {})
      }
      // A session minted here is for building, whatever the last one opened
      // from the analysis pane was for.
      onClick={() => {
        setChatMode(NEW_SESSION, "build");
        void navigate(NEW_SESSION_ROUTE);
      }}
    >
      <IconPencilPlus className="size-5" />
    </RailButton>
  );
}
