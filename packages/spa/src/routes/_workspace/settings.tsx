import { createFileRoute } from "@tanstack/react-router";
import { SettingsPage } from "@/interactions/settings/components/settings-page";

export const Route = createFileRoute("/_workspace/settings")({
  component: SettingsPage,
});
