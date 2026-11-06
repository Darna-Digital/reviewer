// Lets every crawler in and points it at the sitemap. The API routes serve
// the waitlist and the docs search, not pages.
import { createFileRoute } from "@tanstack/react-router";

import { SITE_URL } from "#/lib/links";

const ROBOTS = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`;

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(ROBOTS, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
          },
        }),
    },
  },
});
