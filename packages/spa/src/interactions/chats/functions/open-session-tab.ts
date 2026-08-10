/**
 * Lift a conversation into a window tab of its own, already named, so the strip
 * doesn't have to wait for the chat list to rename it from "New session".
 */
import {
  nextTabId,
  updateWindowTabs,
} from "@/interactions/window-tabs/adapters/window-tabs.store";
import { openTab } from "@/interactions/window-tabs/functions/window-tabs.functions";

export const sessionHref = (chatId: string) => `/modes/agent-session/${chatId}`;

export function openSessionTab(chatId: string, title: string): void {
  updateWindowTabs((state) =>
    openTab(state, {
      id: nextTabId(),
      href: sessionHref(chatId),
      title,
      kind: "session",
    })
  );
}
