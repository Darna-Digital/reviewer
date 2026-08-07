/**
 * Opening the code a node or a note points at.
 *
 * The pane is mounted on the window frame, not inside a route, so it cannot
 * reach the shell's file viewer directly — it goes the way every other jump to
 * code goes: a tab in the strip, and the path and line in the URL. A file opened
 * from an analysis is opened `permanent`, since following a note is a deliberate
 * act and should not be thrown away by the next preview click.
 */
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback } from "react";
import { updateTabs } from "@/interactions/tabs/adapters/tabs.store";
import { openTab } from "@/interactions/tabs/functions/tabs.functions";
import { requestCodeReveal } from "@/lib/code-reveal";
import { CODE_HOME, hasFileViewer } from "../functions/plans-pane.functions";

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
        hasFileViewer(pathname)
          ? { to: ".", search: (prev: object) => ({ ...prev, ...search }) }
          : { to: CODE_HOME, search }
      );
      // The params alone cannot ask twice for the line they already name, so
      // the reveal is requested outright — following the same link a second
      // time has to scroll and flash exactly like the first.
      if (line !== null) requestCodeReveal(filePath, line);
    },
    [navigate, pathname]
  );
}
