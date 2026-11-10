// What the TUI asks to learn whether a newer release is out: the
// install-manifest.txt on the latest GitHub release, by way of here so the
// day's first check is counted (see lib/usage.ts). The install script still
// reads GitHub's copy directly; an install is not a check.
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { usageResponse } from "#/lib/usage";

export const Route = createFileRoute("/install-manifest.txt")({
  server: {
    handlers: {
      GET: ({ request }) =>
        usageResponse(request, "tui", "install-manifest.txt", env.USAGE),
    },
  },
});
