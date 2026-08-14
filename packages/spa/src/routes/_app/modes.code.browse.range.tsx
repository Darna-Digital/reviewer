import { createFileRoute } from "@tanstack/react-router";
import { CodeWorkspace } from "@/components/code-workspace";

// Range diff (base...head) — base/head come from the typed _app search params.
export const Route = createFileRoute("/_app/modes/code/browse/range")({
  component: CodeWorkspace,
});
