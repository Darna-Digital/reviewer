/**
 * The open session's trail, in the toolbar beside the controls that act on the
 * list rather than on a bar of its own over the conversation.
 *
 * "Sessions" hands the window back to the pinned Sessions tab, where the list
 * lives — a conversation lifted into a tab of its own has no list beside it to
 * step back into, and navigating in place would spend the tab holding it. A
 * session yet to be sent wears the same trail, so the way back out of a blank
 * composer is where it is everywhere else.
 *
 * On the list itself the trail is the one word: there is nothing to step back
 * to, and a crumb that leads where you already are is a promise it cannot keep.
 *
 * Every crumb is the one weight. Marking the last one bold retypesets the whole
 * trail whenever the title changes, so the crumbs beside it move — colour
 * carries the distinction instead, and nothing shifts.
 */
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { updateWindowTabs } from "@/interactions/window-tabs/adapters/window-tabs.store";
import {
  SESSIONS_HREF,
  SESSIONS_TAB_ID,
  selectTab,
} from "@/interactions/window-tabs/functions/window-tabs.functions";
import { useQuery } from "@tanstack/react-query";
import { chatQueryOptions } from "@/lib/queries";

export function SessionCrumbs() {
  const { chatId } = useParams({ strict: false });
  const navigate = useNavigate();
  // The conversation's own record rather than the list's copy of it: the list
  // arrives a page at a time, and the trail must name a session however far
  // down it was — this is the cache the route already warms on the way in.
  const chat = useQuery({
    ...chatQueryOptions(chatId ?? ""),
    enabled: chatId !== undefined,
  });

  const startingNew = useSearch({ strict: false }).new === true;
  const title =
    chatId !== undefined
      ? (chat.data?.title ?? "Session")
      : startingNew
        ? "New session"
        : null;

  const showList = () => {
    updateWindowTabs((state) => selectTab(state, SESSIONS_TAB_ID));
    void navigate({ to: SESSIONS_HREF });
  };

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 text-[13px]"
    >
      {title === null ? (
        <span className="shrink-0">Sessions</span>
      ) : (
        <>
          <button
            type="button"
            onClick={showList}
            className="shrink-0 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
          >
            Sessions
          </button>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate">{title}</span>
        </>
      )}
    </nav>
  );
}
