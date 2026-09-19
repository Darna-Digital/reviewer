/**
 * Opening the code something points at, from outside the code page.
 *
 * The Find window lives in the bottom dock, *above* the router's outlet, so it
 * cannot reach the file viewer directly. It goes the way every jump to code
 * goes: a tab in the
 * strip, and the path and line in the URL. A file opened this way is opened
 * `permanent`, since following a result is a deliberate act and should not be
 * thrown away by the next preview click.
 *
 * It also lands in the browser rather than in whichever code page you were on:
 * reading a file a result points at is browsing the project, and commit and
 * review mode are about a particular set of changes the file is not part of.
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";
import { updateTabs } from "@/interactions/tabs/adapters/tabs.store";
import { openTab } from "@/interactions/tabs/functions/tabs.functions";
import { requestCodeReveal } from "@/lib/code-reveal";
import { BROWSE_HREF, isBrowsingCode } from "@/lib/shell-route";

export function useOpenInEditor() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return useCallback(
    (filePath: string, line: number | null) => {
      updateTabs((state) => openTab(state, filePath, "permanent"));
      const search = {
        file: filePath,
        path: filePath,
        line: line ?? undefined,
      };
      void navigate(
        isBrowsingCode(pathname)
          ? { to: ".", search: (prev: object) => ({ ...prev, ...search }) }
          : { to: BROWSE_HREF, search }
      );
      // The params alone cannot ask twice for the line they already name, so
      // the reveal is requested outright — following the same link a second
      // time has to scroll and flash exactly like the first.
      if (line !== null) requestCodeReveal(filePath, line);
    },
    [navigate, pathname]
  );
}
