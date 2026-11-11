// The Mac app's Sparkle feed (SUFeedURL in its Info.plist): the appcast.xml
// on the latest GitHub release, by way of here so the day's first check is
// counted (see lib/usage.ts).
import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";

import { usageResponse } from "#/lib/usage";

export const Route = createFileRoute("/appcast.xml")({
  server: {
    handlers: {
      GET: ({ request }) =>
        usageResponse(request, "mac", "appcast.xml", env.USAGE),
    },
  },
});
