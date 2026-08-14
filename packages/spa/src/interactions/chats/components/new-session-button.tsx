/**
 * Start a session, from the head of the sessions rail — where code mode's rail
 * puts the surface you land on, so the first thing in the column is the thing
 * that makes one.
 */
import { IconPencilPlus } from "@tabler/icons-react";
import { useNavigate } from "@tanstack/react-router";
import { RailButton } from "@/components/layout/rail";
import {
  NEW_SESSION,
  setChatMode,
} from "@/interactions/chats/adapters/chat-mode.store";

export function NewSessionButton() {
  const navigate = useNavigate();
  return (
    <RailButton
      label="New session"
      // A session minted here is for building, whatever the last one opened
      // from the analysis pane was for.
      onClick={() => {
        setChatMode(NEW_SESSION, "build");
        void navigate({ to: "/modes/agent-session", search: { new: true } });
      }}
    >
      <IconPencilPlus className="size-5" />
    </RailButton>
  );
}
