import { createFileRoute } from "@tanstack/react-router";
import { createFromSource } from "fumadocs-core/search/server";

import { source } from "#/lib/docs-source";

// The docs' search dialog asks here; the index is built from the MDX on the
// first request the Worker serves.
const server = createFromSource(source, { language: "english" });

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: ({ request }) => server.GET(request),
    },
  },
});
