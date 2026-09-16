/**
 * The open session's trail, along the top of the pane holding the conversation
 * it names.
 *
 * It was a band of the header before, drawn across the whole window: the trail
 * is about one conversation, so over the list beside it the band was a strip of
 * chrome that said nothing about what was underneath — and it stopped the seam
 * between the two columns a band short of the window bar. In the pane instead,
 * the list runs to the very top and that seam goes all the way up with it. See
 * `ChatsPage`.
 *
 * "Sessions" hands the window back to the pinned Sessions tab, where the list
 * lives — a conversation lifted into a tab of its own has no list beside it to
 * step back into, and navigating in place would spend the tab holding it.
 *
 * On the list itself the trail is the one word: there is nothing to step back
 * to, and a crumb that leads where you already are is a promise it cannot keep.
 *
 * Every crumb is the one weight. Marking the last one bold retypesets the whole
 * trail whenever the title changes, so the crumbs beside it move — colour
 * carries the distinction instead, and nothing shifts.
 */
import { useNavigate, useParams } from "@tanstack/react-router";
import { PaneHeader } from "@/components/layout/pane-header";
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

  const title = chatId === undefined ? null : (chat.data?.title ?? "Session");

  const showList = () => {
    updateWindowTabs((state) => selectTab(state, SESSIONS_TAB_ID));
    void navigate({ to: SESSIONS_HREF });
  };

  return (
    <PaneHeader
      crumbs={
        title === null
          ? [<span className="shrink-0">Sessions</span>]
          : [
              <button
                type="button"
                onClick={showList}
                className="shrink-0 text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
              >
                Sessions
              </button>,
              <span className="truncate">{title}</span>,
            ]
      }
    />
  );
}
