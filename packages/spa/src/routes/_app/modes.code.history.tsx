import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { openBottomTab } from "@/lib/ui-prefs";

/**
 * Branch history — the local changes page with the History dock pulled up.
 *
 * The log lives in a dock rather than on a page of its own, and a dock is not
 * somewhere you can be sent. This is the location that stands for it, so the
 * launchpad has a card to show and picking it lands you where the picture was
 * taken.
 */
export const Route = createFileRoute("/_app/modes/code/history")({
  component: OpenHistoryTab,
});

function OpenHistoryTab() {
  const navigate = useNavigate();
  useEffect(() => {
    openBottomTab("history");
    void navigate({ to: "/modes/code/commit", replace: true });
  }, [navigate]);
  return null;
}
