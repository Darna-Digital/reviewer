/**
 * The open session's trail, in the toolbar beside the controls that act on the
 * list rather than on a bar of its own over the conversation.
 *
 * "Sessions" hands the window back to the pinned Sessions tab, where the list
 * lives — a conversation lifted into a tab of its own has no list beside it to
 * step back into, and navigating in place would spend the tab holding it. A
 * session yet to be sent wears the same trail, so the way back out of a blank
 * composer is where it is everywhere else.
 */
import { useNavigate, useParams } from "@tanstack/react-router";
import { updateWindowTabs } from "@/interactions/window-tabs/adapters/window-tabs.store";
import {
  SESSIONS_HREF,
  SESSIONS_TAB_ID,
  selectTab,
} from "@/interactions/window-tabs/functions/window-tabs.functions";
import { useChats } from "@/lib/queries";

export function SessionCrumbs() {
  const { chatId } = useParams({ strict: false });
  const chats = useChats();
  const navigate = useNavigate();

  const title =
    chatId === undefined
      ? "New session"
      : (chats.data?.find((chat) => chat.id === chatId)?.title ?? "Session");

  const showList = () => {
    updateWindowTabs((state) => selectTab(state, SESSIONS_TAB_ID));
    void navigate({ to: SESSIONS_HREF });
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 text-[13px]"
    >
      <button
        type="button"
        onClick={showList}
        className="shrink-0 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
      >
        Sessions
      </button>
      <span className="text-muted-foreground/50">/</span>
      <span className="truncate font-medium">{title}</span>
    </nav>
  );
}
