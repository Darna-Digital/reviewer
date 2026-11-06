// Every page of the site, for search engines: the product pages, each release
// in the changelog and each docs page. Releases and docs are read at request
// time, so a new one appears without redeploying.
import { createFileRoute } from "@tanstack/react-router";

import { getChangelog } from "#/lib/changelog";
import { source } from "#/lib/docs-source";
import { SITE_URL } from "#/lib/links";

const PAGES = [
  "/",
  "/mac",
  "/terminal",
  "/cloud",
  "/download",
  "/about",
  "/changelog",
];

function entry(path: string, lastmod?: string) {
  return `  <url><loc>${SITE_URL}${path}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const releases = await getChangelog();
        const urls = [
          ...PAGES.map((path) => entry(path)),
          ...releases.map((release) =>
            entry(`/changelog/${release.version}`, release.date)
          ),
          ...source.getPages().map((page) => entry(page.url)),
        ];
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
