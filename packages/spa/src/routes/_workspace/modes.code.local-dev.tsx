import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { openBottomTab } from "@/lib/ui-prefs";

/** Legacy /local-dev route — opens the Services bottom-dock tab. */
export const Route = createFileRoute("/_workspace/modes/code/local-dev")({
  component: OpenServicesTab,
});

function OpenServicesTab() {
  const navigate = useNavigate();
  useEffect(() => {
    openBottomTab("services");
    void navigate({ to: "/modes/code/commit", replace: true });
  }, [navigate]);
  return null;
}
